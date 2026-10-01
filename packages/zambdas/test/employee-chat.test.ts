import Oystehr from '@oystehr/sdk';
import { Encounter, FhirResource, Group, Practitioner } from 'fhir/r4b';
import { EMPLOYEE_CHAT_PAIR_SYSTEM } from 'utils/lib/types/api/employee-chat.types';
import { APIErrorCode, isApiError } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import { getConversationToken, listEmployeeChats } from '../src/ehr/get-employee-chats';
import { resolveEmployeeChat } from '../src/ehr/open-employee-chat/helpers';
import { validateRequestParameters } from '../src/ehr/open-employee-chat/validateRequestParameters';
import {
  buildPairGroup,
  conversationSidsOf,
  otherMemberProfile,
  pairKey,
  readConversationEncounter,
  readConversationSid,
  readPreviousConversations,
  reconcilePairGroups,
  selectCanonicalGroup,
  toSummary,
  withConversation,
  withReplacement,
} from '../src/ehr/shared/employee-chat';

const ALICE = 'Practitioner/1a1a1a1a-0000-0000-0000-000000000000';
const BOB = 'Practitioner/7c7c7c7c-0000-0000-0000-000000000000';
const CHARLIE = 'Practitioner/3f3f3f3f-0000-0000-0000-000000000000';
const CLOSED_SID = 'CH0123456789abcdef0123456789abcdef';

const resolveSid = async (...args: Parameters<typeof resolveEmployeeChat>): Promise<string> =>
  (await resolveEmployeeChat(...args)).conversationSid;

describe('pairKey', () => {
  it('is independent of argument order', () => {
    expect(pairKey(ALICE, BOB)).toBe(pairKey(BOB, ALICE));
  });

  it('sorts the Practitioner ids', () => {
    expect(pairKey(BOB, ALICE)).toBe('1a1a1a1a-0000-0000-0000-000000000000_7c7c7c7c-0000-0000-0000-000000000000');
  });

  it('differs for different pairs', () => {
    const keys = new Set([pairKey(ALICE, BOB), pairKey(ALICE, CHARLIE), pairKey(BOB, CHARLIE)]);
    expect(keys.size).toBe(3);
  });

  it('rejects non-Practitioner references', () => {
    expect(() => pairKey('Patient/1', BOB)).toThrow();
  });
});

describe('buildPairGroup / toSummary', () => {
  const alicePractitioner: Practitioner = {
    resourceType: 'Practitioner',
    id: ALICE.split('/')[1],
    name: [{ given: ['Alice'], family: 'Smith' }],
  };

  it('builds a two-member Group with the pair identifier', () => {
    const group = buildPairGroup(BOB, ALICE);
    expect(group.member?.map((member) => member.entity.reference)).toEqual([ALICE, BOB]);
    expect(group.identifier).toEqual([{ system: EMPLOYEE_CHAT_PAIR_SYSTEM, value: pairKey(ALICE, BOB) }]);
  });

  it('picks the other member for either participant', () => {
    const group = buildPairGroup(ALICE, BOB);
    expect(otherMemberProfile(group, ALICE)).toBe(BOB);
    expect(otherMemberProfile(group, BOB)).toBe(ALICE);
    expect(otherMemberProfile(group, CHARLIE)).toBeUndefined();
  });

  it('returns no summary for a Group without a conversation', () => {
    expect(toSummary(buildPairGroup(ALICE, BOB), new Map(), BOB)).toBeUndefined();
  });

  it('summarizes the other employee from the included Practitioner', () => {
    const group = withConversation(buildPairGroup(ALICE, BOB), 'CH123', 'enc-1');
    expect(toSummary(group, new Map([[ALICE, alicePractitioner]]), BOB)).toEqual({
      conversationSid: 'CH123',
      previousConversationSids: [],
      otherEmployee: { profile: ALICE, firstName: 'Alice', lastName: 'Smith', name: 'Alice Smith' },
    });
  });

  it('replaces an existing conversation extension instead of duplicating it', () => {
    const group = withConversation(withConversation(buildPairGroup(ALICE, BOB), 'CH1', 'e1'), 'CH2', 'e2');
    expect(readConversationSid(group)).toBe('CH2');
    expect(group.extension).toHaveLength(2);
  });

  it('reads no history from a Group written before conversations could be replaced', () => {
    const group = withConversation(buildPairGroup(ALICE, BOB), 'CH1', 'e1');
    expect(readPreviousConversations(group)).toEqual([]);
    expect(toSummary(group, new Map(), BOB)?.previousConversationSids).toEqual([]);
  });

  it('moves the current conversation into ordered history when replacing it', () => {
    const first = withConversation(buildPairGroup(ALICE, BOB), 'CH1', 'e1');
    const second = withReplacement(first, 'CH2', 'e2', '2026-09-25T10:00:00.000Z');
    const third = withReplacement(second, 'CH3', 'e3', '2026-09-27T10:00:00.000Z');

    expect(readConversationSid(third)).toBe('CH3');
    expect(readConversationEncounter(third)).toBe('Encounter/e3');
    expect(readPreviousConversations(third)).toEqual([
      { sid: 'CH1', encounter: 'Encounter/e1', retiredAt: '2026-09-25T10:00:00.000Z' },
      { sid: 'CH2', encounter: 'Encounter/e2', retiredAt: '2026-09-27T10:00:00.000Z' },
    ]);
    expect(toSummary(third, new Map(), BOB)?.previousConversationSids).toEqual(['CH1', 'CH2']);
  });

  it('refuses to replace a Group that has no current conversation', () => {
    expect(() => withReplacement(buildPairGroup(ALICE, BOB), 'CH2', 'e2', '2026-09-25T10:00:00.000Z')).toThrow();
  });
});

describe('reconcilePairGroups', () => {
  const RETIRED_AT = '2026-09-29T12:00:00.000Z';
  const emptyGroup = (id: string): Group => ({ ...buildPairGroup(ALICE, BOB), id, meta: { versionId: '1' } });
  const groupWith = (id: string, sid: string, encounterId: string): Group => ({
    ...withConversation(buildPairGroup(ALICE, BOB), sid, encounterId),
    id,
    meta: { versionId: '1' },
  });

  it('leaves a single Group untouched', () => {
    const only = groupWith('group-a', 'CHA', 'enc-a');
    const pair = reconcilePairGroups([only], RETIRED_AT);
    expect(pair.changed).toBe(false);
    expect(pair.reconciled).toBe(only);
    expect(pair.retired).toEqual([]);
  });

  it('selects the lowest resource id as canonical regardless of search order', () => {
    const groups = [emptyGroup('group-c'), emptyGroup('group-a'), emptyGroup('group-b')];
    expect(selectCanonicalGroup(groups).canonical.id).toBe('group-a');
    expect(selectCanonicalGroup([...groups].reverse()).canonical.id).toBe('group-a');
    expect(selectCanonicalGroup(groups).duplicates.map((group) => group.id)).toEqual(['group-b', 'group-c']);
  });

  it('has nothing to absorb from empty duplicates', () => {
    const pair = reconcilePairGroups([emptyGroup('group-b'), emptyGroup('group-a')], RETIRED_AT);
    expect(pair.canonical.id).toBe('group-a');
    expect(pair.changed).toBe(false);
  });

  it('adopts the conversation of a duplicate when the canonical Group has none', () => {
    const pair = reconcilePairGroups([emptyGroup('group-a'), groupWith('group-b', 'CHB', 'enc-b')], RETIRED_AT);
    expect(pair.changed).toBe(true);
    expect(pair.reconciled.id).toBe('group-a');
    expect(readConversationSid(pair.reconciled)).toBe('CHB');
    expect(readConversationEncounter(pair.reconciled)).toBe('Encounter/enc-b');
    expect(readPreviousConversations(pair.reconciled)).toEqual([]);
    expect(pair.retired).toEqual([]);
  });

  it('keeps the canonical conversation current and moves a different duplicate conversation into history', () => {
    const pair = reconcilePairGroups(
      [groupWith('group-b', 'CHB', 'enc-b'), groupWith('group-a', 'CHA', 'enc-a')],
      RETIRED_AT
    );
    expect(readConversationSid(pair.reconciled)).toBe('CHA');
    expect(readPreviousConversations(pair.reconciled)).toEqual([
      { sid: 'CHB', encounter: 'Encounter/enc-b', retiredAt: RETIRED_AT },
    ]);
    expect(pair.retired).toEqual([{ sid: 'CHB', encounter: 'Encounter/enc-b', retiredAt: RETIRED_AT }]);
  });

  it('merges duplicate history without repeating conversations the canonical Group already knows', () => {
    const canonical = withReplacement(groupWith('group-a', 'CH1', 'e1'), 'CH2', 'e2', '2026-09-01T00:00:00.000Z');
    const duplicate = withReplacement(groupWith('group-b', 'CH1', 'e1'), 'CH3', 'e3', '2026-09-02T00:00:00.000Z');
    const pair = reconcilePairGroups([duplicate, canonical], RETIRED_AT);

    expect(readConversationSid(pair.reconciled)).toBe('CH2');
    expect(readPreviousConversations(pair.reconciled).map((retired) => retired.sid)).toEqual(['CH1', 'CH3']);
    expect(pair.retired.map((retired) => retired.sid)).toEqual(['CH3']);
  });

  it('is idempotent once the canonical Group has absorbed its duplicates', () => {
    const duplicates = [groupWith('group-b', 'CHB', 'enc-b'), groupWith('group-c', 'CHC', 'enc-c')];
    const first = reconcilePairGroups([groupWith('group-a', 'CHA', 'enc-a'), ...duplicates], RETIRED_AT);
    const second = reconcilePairGroups([first.reconciled, ...duplicates], '2026-09-30T00:00:00.000Z');

    expect(second.changed).toBe(false);
    expect(second.reconciled).toBe(first.reconciled);
    expect(conversationSidsOf(second.reconciled)).toEqual(['CHB', 'CHC', 'CHA']);
  });
});

describe('open-employee-chat validateRequestParameters', () => {
  const base = { headers: { Authorization: 'Bearer token' }, secrets: {} };

  it('accepts a Practitioner reference', () => {
    expect(validateRequestParameters({ ...base, body: JSON.stringify({ targetProfile: BOB }) }).targetProfile).toBe(
      BOB
    );
  });

  it('accepts an optional Twilio Conversation SID to replace', () => {
    const validated = validateRequestParameters({
      ...base,
      body: JSON.stringify({ targetProfile: BOB, replaceClosedConversationSid: CLOSED_SID }),
    });
    expect(validated.replaceClosedConversationSid).toBe(CLOSED_SID);
    expect(
      validateRequestParameters({ ...base, body: JSON.stringify({ targetProfile: BOB }) }).replaceClosedConversationSid
    ).toBeUndefined();
  });

  it('rejects a malformed conversation SID to replace', () => {
    for (const replaceClosedConversationSid of ['CH123', 'IS0123456789abcdef0123456789abcdef', 'Group/1', 42]) {
      expect(() =>
        validateRequestParameters({
          ...base,
          body: JSON.stringify({ targetProfile: BOB, replaceClosedConversationSid }),
        })
      ).toThrow();
    }
  });

  it('rejects a missing body', () => {
    expect(() => validateRequestParameters({ ...base, body: null })).toThrow();
  });

  it('rejects a missing or malformed target', () => {
    expect(() => validateRequestParameters({ ...base, body: '{}' })).toThrow();
    expect(() =>
      validateRequestParameters({ ...base, body: JSON.stringify({ targetProfile: 'Patient/1' }) })
    ).toThrow();
    expect(() =>
      validateRequestParameters({ ...base, body: JSON.stringify({ targetProfile: 'Practitioner/../Group' }) })
    ).toThrow();
  });
});

class PreconditionFailed extends Error {
  code = 412;
}

class OystehrForbidden extends Error {
  code = '4031';
  constructor() {
    super('Forbidden');
  }
}

type ConversationAction = 'CreateConversation' | 'ConversationAddParticipant' | 'ConversationRemoveParticipant';

interface FakeFailures {
  addParticipant?: Error;
  removeParticipant?: Error;
  groupUpdate?: Error;
  groupUpdateAfterCommit?: Error;
  groupGet?: Error;
  encounterFinish?: Error;
  denied?: Set<ConversationAction>;
  serverPageCap?: number;
  maxSearchPageSize?: number;
}

function createFakeOystehr(): {
  oystehr: Oystehr;
  seed: (resource: FhirResource) => FhirResource;
  groups: () => Group[];
  encounters: () => Encounter[];
  conversationsCreated: () => number;
  participantsAdded: () => string[][];
  participantsRemoved: () => { conversationId: string; participantReference: string }[];
  removalAttempts: () => { conversationId: string; participantReference: string }[];
  searches: () => { offset: number; pageSize: number | undefined }[];
  failures: FakeFailures;
} {
  const store = new Map<string, FhirResource>();
  const searches: { offset: number; pageSize: number | undefined }[] = [];
  let nextId = 0;
  let conversations = 0;
  const participants: string[][] = [];
  const removed: { conversationId: string; participantReference: string }[] = [];
  const removalAttempts: { conversationId: string; participantReference: string }[] = [];
  const failures: FakeFailures = {};
  const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  const save = (resource: FhirResource): FhirResource => {
    const existing = resource.id ? store.get(`${resource.resourceType}/${resource.id}`) : undefined;
    const version = existing ? Number(existing.meta?.versionId ?? '0') + 1 : 1;
    const saved = {
      ...resource,
      id: resource.id ?? `id-${++nextId}`,
      meta: { ...resource.meta, versionId: String(version) },
    } as FhirResource;
    store.set(`${saved.resourceType}/${saved.id}`, saved);
    return structuredClone(saved);
  };

  const fhir = {
    create: async (resource: FhirResource) => {
      await tick();
      return save(resource);
    },
    search: async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
      await tick();
      const param = (name: string): string | undefined => params.find((candidate) => candidate.name === name)?.value;
      const identifier = param('identifier');
      const member = param('member');
      const requested = param('_count') === undefined ? undefined : Number(param('_count'));
      const offset = Number(param('_offset') ?? '0');
      if (
        requested !== undefined &&
        failures.maxSearchPageSize !== undefined &&
        requested > failures.maxSearchPageSize
      ) {
        throw Object.assign(new Error('Response size exceeds the maximum allowed size'), { code: 4130 });
      }
      const pageSize = Math.min(requested ?? Infinity, failures.serverPageCap ?? Infinity);
      searches.push({ offset, pageSize: requested });
      const matches = ([...store.values()] as Group[]).filter(
        (candidate) =>
          candidate.resourceType === resourceType &&
          (!identifier || candidate.identifier?.some((id) => `${id.system}|${id.value}` === identifier)) &&
          (!member || candidate.member?.some((entry) => entry.entity.reference === member))
      );
      const page = matches.slice(offset, offset + pageSize);
      const included =
        param('_include') === 'Group:member'
          ? [
              ...new Set(page.flatMap((group) => group.member?.map((entry) => entry.entity.reference ?? '') ?? [])),
            ].flatMap((reference) => (store.has(reference) ? [store.get(reference)!] : []))
          : [];
      const entry = structuredClone([
        ...page.map((resource) => ({ resource, search: { mode: 'match' } })),
        ...included.map((resource) => ({ resource, search: { mode: 'include' } })),
      ]);
      return {
        entry,
        total: param('_total') === 'accurate' ? matches.length : undefined,
        unbundle: () => entry.map((item) => item.resource),
      };
    },
    update: async (resource: FhirResource, options?: { optimisticLockingVersionId?: string }) => {
      await tick();
      if (resource.resourceType === 'Group' && failures.groupUpdate) throw failures.groupUpdate;
      if (resource.resourceType === 'Encounter' && resource.status === 'finished' && failures.encounterFinish) {
        throw failures.encounterFinish;
      }
      const current = store.get(`${resource.resourceType}/${resource.id}`);
      if (options?.optimisticLockingVersionId && current?.meta?.versionId !== options.optimisticLockingVersionId) {
        throw new PreconditionFailed('Precondition Failed');
      }
      const saved = save(resource);
      if (resource.resourceType === 'Group' && failures.groupUpdateAfterCommit) throw failures.groupUpdateAfterCommit;
      return saved;
    },
    get: async ({ resourceType, id }: { resourceType: string; id: string }) => {
      await tick();
      if (resourceType === 'Group' && failures.groupGet) throw failures.groupGet;
      return structuredClone(store.get(`${resourceType}/${id}`));
    },
  };

  const authorize = (action: ConversationAction): void => {
    if (failures.denied?.has(action)) throw new OystehrForbidden();
  };

  const conversation = {
    create: async ({ encounter }: { encounter: Encounter }) => {
      await tick();
      authorize('CreateConversation');
      const sid = `CH${++conversations}`;
      return {
        encounter: save({
          ...encounter,
          extension: [{ url: 'sid', valueString: sid }],
        } as Encounter) as Encounter,
      };
    },
    getConversationIdFromEncounter: (encounter: Encounter) =>
      encounter.extension?.find((extension) => extension.url === 'sid')?.valueString,
    addParticipant: async ({ participants: added }: { participants: { participantReference: string }[] }) => {
      await tick();
      authorize('ConversationAddParticipant');
      if (failures.addParticipant) throw failures.addParticipant;
      participants.push(added.map((participant) => participant.participantReference));
    },
    removeParticipant: async ({
      conversationId,
      participantReference,
    }: {
      conversationId: string;
      participantReference: string;
    }) => {
      await tick();
      removalAttempts.push({ conversationId, participantReference });
      authorize('ConversationRemoveParticipant');
      if (failures.removeParticipant) throw failures.removeParticipant;
      removed.push({ conversationId, participantReference });
    },
  };

  const all = (type: string): FhirResource[] => [...store.values()].filter((r) => r.resourceType === type);
  return {
    oystehr: { fhir, conversation } as unknown as Oystehr,
    seed: (resource: FhirResource) => save(resource),
    groups: () => all('Group') as Group[],
    encounters: () => all('Encounter') as Encounter[],
    conversationsCreated: () => conversations,
    participantsAdded: () => participants,
    participantsRemoved: () => removed,
    removalAttempts: () => removalAttempts,
    searches: () => searches,
    failures,
  };
}

describe('resolveEmployeeChat', () => {
  it('creates the pair Group and conversation with exactly the two participants', async () => {
    const fake = createFakeOystehr();
    const sid = await resolveSid(fake.oystehr, ALICE, BOB);

    expect(fake.groups()).toHaveLength(1);
    expect(readConversationSid(fake.groups()[0])).toBe(sid);
    expect(fake.participantsAdded()).toEqual([[ALICE, BOB]]);
    expect(fake.encounters()[0].participant?.map((p) => p.individual?.reference)).toEqual([ALICE, BOB]);
    expect(fake.participantsRemoved()).toEqual([]);
  });

  it('returns the same conversation for the same pair in either order without creating another', async () => {
    const fake = createFakeOystehr();
    const first = await resolveSid(fake.oystehr, ALICE, BOB);
    const second = await resolveSid(fake.oystehr, BOB, ALICE);

    expect(second).toBe(first);
    expect(fake.conversationsCreated()).toBe(1);
    expect(fake.groups()).toHaveLength(1);
  });

  it('creates a different conversation for a different pair', async () => {
    const fake = createFakeOystehr();
    const aliceBob = await resolveSid(fake.oystehr, ALICE, BOB);
    const aliceCharlie = await resolveSid(fake.oystehr, ALICE, CHARLIE);

    expect(aliceCharlie).not.toBe(aliceBob);
    expect(fake.groups()).toHaveLength(2);
  });

  it('converges concurrent first opens that each create a Group on the canonical Group and cleans up only the losing conversation', async () => {
    const fake = createFakeOystehr();
    const [fromAlice, fromBob] = await Promise.all([
      resolveSid(fake.oystehr, ALICE, BOB),
      resolveSid(fake.oystehr, BOB, ALICE),
    ]);

    expect(fromAlice).toBe(fromBob);
    expect(fake.groups()).toHaveLength(2);
    const { canonical, duplicates } = selectCanonicalGroup(fake.groups());
    expect(readConversationSid(canonical)).toBe(fromAlice);
    expect(duplicates.flatMap(conversationSidsOf)).toEqual([]);
    expect(fake.conversationsCreated()).toBe(2);
    const losing = fromAlice === 'CH1' ? 'CH2' : 'CH1';
    expect(fake.participantsRemoved()).toHaveLength(2);
    expect(fake.participantsRemoved()).toEqual(
      expect.arrayContaining([
        { conversationId: losing, participantReference: ALICE },
        { conversationId: losing, participantReference: BOB },
      ])
    );
    expect(
      fake
        .encounters()
        .map((encounter) => encounter.status)
        .sort()
    ).toEqual(['cancelled', 'in-progress']);
  });

  it('removes both employees, cancels the Encounter and rethrows the original error when adding participants fails', async () => {
    const fake = createFakeOystehr();
    const original = new Error('User conversation limit exceeded');
    fake.failures.addParticipant = original;

    await expect(resolveSid(fake.oystehr, ALICE, BOB)).rejects.toBe(original);

    expect(fake.participantsRemoved()).toHaveLength(2);
    expect(fake.participantsRemoved()).toEqual(
      expect.arrayContaining([
        { conversationId: 'CH1', participantReference: ALICE },
        { conversationId: 'CH1', participantReference: BOB },
      ])
    );
    expect(fake.encounters().map((encounter) => encounter.status)).toEqual(['cancelled']);
    expect(readConversationSid(fake.groups()[0])).toBeUndefined();

    fake.failures.addParticipant = undefined;
    const retried = await resolveSid(fake.oystehr, ALICE, BOB);
    expect(retried).toBe('CH2');
    expect(readConversationSid(fake.groups()[0])).toBe('CH2');
  });

  it('removes both employees and cancels the Encounter when storing the conversation on the Group fails', async () => {
    const fake = createFakeOystehr();
    const original = new Error('FHIR unavailable');
    fake.failures.groupUpdate = original;

    await expect(resolveSid(fake.oystehr, ALICE, BOB)).rejects.toBe(original);

    expect(fake.participantsAdded()).toEqual([[ALICE, BOB]]);
    expect(fake.participantsRemoved()).toHaveLength(2);
    expect(fake.participantsRemoved()).toEqual(
      expect.arrayContaining([
        { conversationId: 'CH1', participantReference: ALICE },
        { conversationId: 'CH1', participantReference: BOB },
      ])
    );
    expect(fake.encounters().map((encounter) => encounter.status)).toEqual(['cancelled']);
  });

  it.each([
    ['a retry reports 412', new PreconditionFailed('Precondition Failed')],
    ['the final attempt reports a non-412 error', new Error('Gateway Timeout')],
  ])('keeps the conversation it stored when the Group write commits but %s', async (_case, observed) => {
    const fake = createFakeOystehr();
    fake.failures.groupUpdateAfterCommit = observed;

    const sid = await resolveSid(fake.oystehr, ALICE, BOB);

    expect(readConversationSid(fake.groups()[0])).toBe(sid);
    expect(fake.participantsRemoved()).toEqual([]);
    expect(fake.encounters().map((encounter) => encounter.status)).toEqual(['in-progress']);

    fake.failures.groupUpdateAfterCommit = undefined;
    expect(await resolveSid(fake.oystehr, BOB, ALICE)).toBe(sid);
    expect(fake.conversationsCreated()).toBe(1);
  });

  it('leaves the conversation in place and rethrows when the Group cannot be re-read after a failed write', async () => {
    const fake = createFakeOystehr();
    const original = new Error('Gateway Timeout');
    fake.failures.groupUpdateAfterCommit = original;
    fake.failures.groupGet = new Error('FHIR unavailable');

    await expect(resolveSid(fake.oystehr, ALICE, BOB)).rejects.toBe(original);

    expect(fake.participantsRemoved()).toEqual([]);
    expect(fake.encounters().map((encounter) => encounter.status)).toEqual(['in-progress']);
  });

  it('keeps the original error when removing participants during cleanup also fails', async () => {
    const fake = createFakeOystehr();
    const original = new Error('User conversation limit exceeded');
    fake.failures.addParticipant = original;
    fake.failures.removeParticipant = new Error('Participant not found in the conversation.');

    await expect(resolveSid(fake.oystehr, ALICE, BOB)).rejects.toBe(original);

    expect(fake.encounters().map((encounter) => encounter.status)).toEqual(['cancelled']);
  });
});

describe('resolveEmployeeChat replacing a closed conversation', () => {
  const statusOf = (fake: ReturnType<typeof createFakeOystehr>, sid: string): string | undefined =>
    fake.encounters().find((encounter) => encounter.extension?.some((extension) => extension.valueString === sid))
      ?.status;

  const removedFrom = (fake: ReturnType<typeof createFakeOystehr>, sid: string): string[] =>
    fake
      .participantsRemoved()
      .filter((removal) => removal.conversationId === sid)
      .map((removal) => removal.participantReference);

  it('keeps returning the current conversation of an existing Group that has no history', async () => {
    const fake = createFakeOystehr();
    await resolveSid(fake.oystehr, ALICE, BOB);

    expect(await resolveEmployeeChat(fake.oystehr, BOB, ALICE)).toEqual({
      conversationSid: 'CH1',
      previousConversationSids: [],
    });
    expect(fake.conversationsCreated()).toBe(1);
  });

  it('installs a new conversation with both participants and moves the closed one into history', async () => {
    const fake = createFakeOystehr();
    const closed = await resolveSid(fake.oystehr, ALICE, BOB);

    const replaced = await resolveEmployeeChat(fake.oystehr, BOB, ALICE, closed);

    expect(replaced).toEqual({ conversationSid: 'CH2', previousConversationSids: [closed] });
    const group = fake.groups()[0];
    expect(readConversationSid(group)).toBe('CH2');
    expect(readPreviousConversations(group).map((retired) => retired.sid)).toEqual([closed]);
    expect(readPreviousConversations(group)[0].encounter).toMatch(/^Encounter\//);
    expect(fake.participantsAdded()).toEqual([
      [ALICE, BOB],
      [BOB, ALICE],
    ]);
    expect(statusOf(fake, closed)).toBe('finished');
    expect(statusOf(fake, 'CH2')).toBe('in-progress');
    expect(fake.participantsRemoved()).toEqual([]);
  });

  it('returns the current conversation to a stale replacement request without creating another', async () => {
    const fake = createFakeOystehr();
    const closed = await resolveSid(fake.oystehr, ALICE, BOB);
    const replacement = await resolveSid(fake.oystehr, ALICE, BOB, closed);

    const stale = await resolveEmployeeChat(fake.oystehr, BOB, ALICE, closed);

    expect(stale).toEqual({ conversationSid: replacement, previousConversationSids: [closed] });
    expect(fake.conversationsCreated()).toBe(2);
    expect(readPreviousConversations(fake.groups()[0])).toHaveLength(1);
  });

  it('converges concurrent replacements on one canonical conversation and discards only the losing candidate', async () => {
    const fake = createFakeOystehr();
    const closed = await resolveSid(fake.oystehr, ALICE, BOB);

    const [fromAlice, fromBob] = await Promise.all([
      resolveEmployeeChat(fake.oystehr, ALICE, BOB, closed),
      resolveEmployeeChat(fake.oystehr, BOB, ALICE, closed),
    ]);

    expect(fromAlice).toEqual(fromBob);
    expect(fromAlice.previousConversationSids).toEqual([closed]);
    expect(fake.conversationsCreated()).toBe(3);
    const winner = fromAlice.conversationSid;
    const loser = winner === 'CH2' ? 'CH3' : 'CH2';
    expect(readConversationSid(fake.groups()[0])).toBe(winner);
    expect(readPreviousConversations(fake.groups()[0]).map((retired) => retired.sid)).toEqual([closed]);
    expect(removedFrom(fake, loser).sort()).toEqual([ALICE, BOB].sort());
    expect(removedFrom(fake, winner)).toEqual([]);
    expect(removedFrom(fake, closed)).toEqual([]);
    expect(statusOf(fake, closed)).toBe('finished');
    expect(statusOf(fake, winner)).toBe('in-progress');
    expect(statusOf(fake, loser)).toBe('cancelled');
  });

  it.each([
    ['a retry reports 412', new PreconditionFailed('Precondition Failed')],
    ['the final attempt reports a non-412 error', new Error('Gateway Timeout')],
  ])('keeps the replacement it stored when the Group write commits but %s', async (_case, observed) => {
    const fake = createFakeOystehr();
    const closed = await resolveSid(fake.oystehr, ALICE, BOB);
    fake.failures.groupUpdateAfterCommit = observed;

    const replaced = await resolveEmployeeChat(fake.oystehr, ALICE, BOB, closed);

    expect(replaced).toEqual({ conversationSid: 'CH2', previousConversationSids: [closed] });
    expect(readConversationSid(fake.groups()[0])).toBe('CH2');
    expect(fake.participantsRemoved()).toEqual([]);
    expect(statusOf(fake, 'CH2')).toBe('in-progress');
  });

  it('discards the candidate and keeps the closed conversation current when adding participants fails', async () => {
    const fake = createFakeOystehr();
    const closed = await resolveSid(fake.oystehr, ALICE, BOB);
    const original = new Error('User conversation limit exceeded');
    fake.failures.addParticipant = original;

    await expect(resolveEmployeeChat(fake.oystehr, ALICE, BOB, closed)).rejects.toBe(original);

    expect(removedFrom(fake, 'CH2').sort()).toEqual([ALICE, BOB].sort());
    expect(removedFrom(fake, closed)).toEqual([]);
    expect(statusOf(fake, 'CH2')).toBe('cancelled');
    expect(statusOf(fake, closed)).toBe('in-progress');
    expect(readConversationSid(fake.groups()[0])).toBe(closed);
    expect(readPreviousConversations(fake.groups()[0])).toEqual([]);
  });

  it('keeps the replacement when finishing the retired Encounter fails', async () => {
    const fake = createFakeOystehr();
    const closed = await resolveSid(fake.oystehr, ALICE, BOB);
    fake.failures.encounterFinish = new Error('FHIR unavailable');

    const replaced = await resolveEmployeeChat(fake.oystehr, ALICE, BOB, closed);

    expect(replaced).toEqual({ conversationSid: 'CH2', previousConversationSids: [closed] });
    expect(readConversationSid(fake.groups()[0])).toBe('CH2');
    expect(statusOf(fake, closed)).toBe('in-progress');
    expect(fake.participantsRemoved()).toEqual([]);
  });

  it('keeps the closed conversation canonical when Oystehr denies adding participants, without doomed removals', async () => {
    const fake = createFakeOystehr();
    const closed = await resolveSid(fake.oystehr, ALICE, BOB);
    fake.failures.denied = new Set(['ConversationAddParticipant', 'ConversationRemoveParticipant']);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const attempt = resolveEmployeeChat(fake.oystehr, BOB, ALICE, closed);

    await expect(attempt).rejects.toBeInstanceOf(OystehrForbidden);
    expect(fake.conversationsCreated()).toBe(2);
    expect(fake.removalAttempts()).toEqual([]);
    expect(statusOf(fake, 'CH2')).toBe('cancelled');
    expect(statusOf(fake, closed)).toBe('in-progress');
    expect(readConversationSid(fake.groups()[0])).toBe(closed);
    expect(readPreviousConversations(fake.groups()[0])).toEqual([]);
    expect(logged.mock.calls[0][0]).toContain('Adding employee chat participants to candidate conversation CH2 failed');
    expect(logged.mock.calls[0][1]).toBeInstanceOf(OystehrForbidden);
    logged.mockRestore();
  });

  it('reports a losing candidate it could not empty as an orphan and still returns the winner', async () => {
    const fake = createFakeOystehr();
    const closed = await resolveSid(fake.oystehr, ALICE, BOB);
    fake.failures.denied = new Set(['ConversationRemoveParticipant']);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const [fromAlice, fromBob] = await Promise.all([
      resolveEmployeeChat(fake.oystehr, ALICE, BOB, closed),
      resolveEmployeeChat(fake.oystehr, BOB, ALICE, closed),
    ]);

    expect(fromAlice).toEqual(fromBob);
    const loser = fromAlice.conversationSid === 'CH2' ? 'CH3' : 'CH2';
    expect(statusOf(fake, loser)).toBe('cancelled');
    expect(fake.removalAttempts().map((attempt) => attempt.conversationId)).toEqual([loser, loser]);
    expect(logged.mock.calls.map((call) => String(call[0]))).toContainEqual(
      expect.stringContaining(`Orphan employee chat conversation ${loser} still has 2 participant(s)`)
    );
    logged.mockRestore();
  });

  it('never removes participants from a retired conversation, across repeated and racing replacements', async () => {
    const fake = createFakeOystehr();
    const first = await resolveSid(fake.oystehr, ALICE, BOB);
    const second = await resolveSid(fake.oystehr, ALICE, BOB, first);
    const [a, b] = await Promise.all([
      resolveSid(fake.oystehr, ALICE, BOB, second),
      resolveSid(fake.oystehr, BOB, ALICE, second),
    ]);
    await resolveSid(fake.oystehr, ALICE, BOB, first);
    fake.failures.addParticipant = new Error('User conversation limit exceeded');
    await expect(resolveEmployeeChat(fake.oystehr, ALICE, BOB, a)).rejects.toThrow();

    expect(a).toBe(b);
    expect(readConversationSid(fake.groups()[0])).toBe(a);
    const retired = readPreviousConversations(fake.groups()[0]).map((conversation) => conversation.sid);
    expect(retired).toEqual([first, second]);
    for (const sid of [...retired, a]) {
      expect(removedFrom(fake, sid)).toEqual([]);
    }
    expect(fake.participantsRemoved()).toHaveLength(4);
  });
});

describe('resolveEmployeeChat with duplicate pair Groups', () => {
  const seedEncounter = (fake: ReturnType<typeof createFakeOystehr>, id: string, sid: string): void => {
    fake.seed({
      resourceType: 'Encounter',
      id,
      status: 'in-progress',
      class: {},
      extension: [{ url: 'sid', valueString: sid }],
    });
  };
  const seedGroup = (fake: ReturnType<typeof createFakeOystehr>, id: string, sid?: string): void => {
    const group = { ...buildPairGroup(ALICE, BOB), id };
    if (!sid) {
      fake.seed(group);
      return;
    }
    seedEncounter(fake, `enc-${id}`, sid);
    fake.seed(withConversation(group, sid, `enc-${id}`));
  };
  const groupById = (fake: ReturnType<typeof createFakeOystehr>, id: string): Group =>
    fake.groups().find((group) => group.id === id)!;
  const versions = (fake: ReturnType<typeof createFakeOystehr>): Record<string, string | undefined> =>
    Object.fromEntries(fake.groups().map((group) => [group.id, group.meta?.versionId]));

  it('stores one new conversation on the canonical Group when both duplicates are empty', async () => {
    const fake = createFakeOystehr();
    seedGroup(fake, 'group-b');
    seedGroup(fake, 'group-a');

    const resolved = await resolveEmployeeChat(fake.oystehr, BOB, ALICE);

    expect(resolved).toEqual({ conversationSid: 'CH1', previousConversationSids: [] });
    expect(readConversationSid(groupById(fake, 'group-a'))).toBe('CH1');
    expect(conversationSidsOf(groupById(fake, 'group-b'))).toEqual([]);
    expect(fake.conversationsCreated()).toBe(1);
  });

  it('keeps the only existing conversation current even when it lives on the non-canonical Group', async () => {
    const fake = createFakeOystehr();
    seedGroup(fake, 'group-a');
    seedGroup(fake, 'group-b', 'CHB');

    const resolved = await resolveEmployeeChat(fake.oystehr, ALICE, BOB);

    expect(resolved).toEqual({ conversationSid: 'CHB', previousConversationSids: [] });
    expect(readConversationSid(groupById(fake, 'group-a'))).toBe('CHB');
    expect(fake.conversationsCreated()).toBe(0);
    expect(fake.participantsRemoved()).toEqual([]);
  });

  it('heals two Groups holding different conversations without losing either, idempotently', async () => {
    const fake = createFakeOystehr();
    seedGroup(fake, 'group-b', 'CHB');
    seedGroup(fake, 'group-a', 'CHA');

    const healed = await resolveEmployeeChat(fake.oystehr, BOB, ALICE);

    expect(healed).toEqual({ conversationSid: 'CHA', previousConversationSids: ['CHB'] });
    const canonical = groupById(fake, 'group-a');
    expect(readConversationSid(canonical)).toBe('CHA');
    expect(readPreviousConversations(canonical)).toEqual([
      { sid: 'CHB', encounter: 'Encounter/enc-group-b', retiredAt: expect.any(String) },
    ]);
    expect(readConversationSid(groupById(fake, 'group-b'))).toBe('CHB');
    expect(fake.encounters().find((encounter) => encounter.id === 'enc-group-b')?.status).toBe('finished');
    expect(fake.encounters().find((encounter) => encounter.id === 'enc-group-a')?.status).toBe('in-progress');
    expect(fake.conversationsCreated()).toBe(0);
    expect(fake.participantsRemoved()).toEqual([]);

    const before = versions(fake);
    expect(await resolveEmployeeChat(fake.oystehr, ALICE, BOB)).toEqual(healed);
    expect(await resolveEmployeeChat(fake.oystehr, BOB, ALICE)).toEqual(healed);
    expect(versions(fake)).toEqual(before);
    expect(readPreviousConversations(groupById(fake, 'group-a'))).toHaveLength(1);
  });

  it('converges concurrent opens of an already duplicated pair on one conversation and one history entry', async () => {
    const fake = createFakeOystehr();
    seedGroup(fake, 'group-a', 'CHA');
    seedGroup(fake, 'group-b', 'CHB');

    const results = await Promise.all([
      resolveEmployeeChat(fake.oystehr, ALICE, BOB),
      resolveEmployeeChat(fake.oystehr, BOB, ALICE),
      resolveEmployeeChat(fake.oystehr, ALICE, BOB),
    ]);

    for (const result of results) {
      expect(result).toEqual({ conversationSid: 'CHA', previousConversationSids: ['CHB'] });
    }
    expect(readPreviousConversations(groupById(fake, 'group-a')).map((retired) => retired.sid)).toEqual(['CHB']);
  });

  it('converges many concurrent first opens on a single stored conversation', async () => {
    const fake = createFakeOystehr();

    const sids = await Promise.all(
      [ALICE, BOB, ALICE, BOB].map((caller) => resolveSid(fake.oystehr, caller, caller === ALICE ? BOB : ALICE))
    );

    expect(new Set(sids).size).toBe(1);
    const { canonical, duplicates } = selectCanonicalGroup(fake.groups());
    expect(readConversationSid(canonical)).toBe(sids[0]);
    expect(duplicates.flatMap(conversationSidsOf)).toEqual([]);
    const cancelled = fake.encounters().filter((encounter) => encounter.status === 'cancelled').length;
    expect(cancelled).toBe(fake.conversationsCreated() - 1);
  });

  it('replaces a closed conversation on the canonical Group and keeps the duplicate conversation in history', async () => {
    const fake = createFakeOystehr();
    seedGroup(fake, 'group-a', 'CHA');
    seedGroup(fake, 'group-b', 'CHB');
    await resolveEmployeeChat(fake.oystehr, ALICE, BOB);

    const replaced = await resolveEmployeeChat(fake.oystehr, ALICE, BOB, 'CHA');

    expect(replaced).toEqual({ conversationSid: 'CH1', previousConversationSids: ['CHB', 'CHA'] });
    expect(fake.encounters().find((encounter) => encounter.id === 'enc-group-a')?.status).toBe('finished');
  });

  it('lists a duplicated pair once with the canonical conversation and the merged history', async () => {
    const fake = createFakeOystehr();
    fake.seed({ resourceType: 'Practitioner', id: BOB.split('/')[1], name: [{ given: ['Bob'], family: 'Jones' }] });
    seedGroup(fake, 'group-b', 'CHB');
    seedGroup(fake, 'group-a', 'CHA');
    const carolGroup = withConversation({ ...buildPairGroup(ALICE, CHARLIE), id: 'group-c' }, 'CHC', 'enc-c');
    fake.seed(carolGroup);

    const listedBeforeHealing = await listEmployeeChats(fake.oystehr, ALICE);
    await resolveEmployeeChat(fake.oystehr, ALICE, BOB);
    const listedAfterHealing = await listEmployeeChats(fake.oystehr, ALICE);

    for (const listed of [listedBeforeHealing, listedAfterHealing]) {
      expect(listed.filter((chat) => chat.otherEmployee.profile === BOB)).toEqual([
        {
          conversationSid: 'CHA',
          previousConversationSids: ['CHB'],
          otherEmployee: { profile: BOB, firstName: 'Bob', lastName: 'Jones', name: 'Bob Jones' },
        },
      ]);
      expect(listed.map((chat) => chat.otherEmployee.profile).sort()).toEqual([BOB, CHARLIE].sort());
    }
  });

  it('lists a pair whose only conversation lives on the non-canonical Group', async () => {
    const fake = createFakeOystehr();
    seedGroup(fake, 'group-a');
    seedGroup(fake, 'group-b', 'CHB');

    const listed = await listEmployeeChats(fake.oystehr, BOB);

    expect(listed.map((chat) => [chat.conversationSid, chat.otherEmployee.profile])).toEqual([['CHB', ALICE]]);
  });
});

describe('listEmployeeChats paging', () => {
  const seedChats = (fake: ReturnType<typeof createFakeOystehr>, count: number): string[] =>
    Array.from({ length: count }, (_unused, i) => {
      const id = `${i}${i}${i}${i}${i}${i}${i}${i}-0000-0000-0000-000000000000`;
      const profile = `Practitioner/${id}`;
      fake.seed({ resourceType: 'Practitioner', id, name: [{ given: [`Emp${i}`], family: 'Paged' }] });
      fake.seed(withConversation({ ...buildPairGroup(ALICE, profile), id: `group-${i}` }, `CH${i}`, `enc-${i}`));
      return profile;
    });

  it.each([
    ['the server returns fewer matches per page than requested', { serverPageCap: 2 }],
    ['a page exceeds the response size limit', { maxSearchPageSize: 2 }],
  ])('lists every chat with its employee name when %s', async (_case, failures) => {
    const fake = createFakeOystehr();
    const profiles = seedChats(fake, 5);
    Object.assign(fake.failures, failures);

    const chats = await listEmployeeChats(fake.oystehr, ALICE);

    expect(chats.map((chat) => chat.conversationSid).sort()).toEqual(['CH0', 'CH1', 'CH2', 'CH3', 'CH4']);
    expect(chats.map((chat) => chat.otherEmployee.profile).sort()).toEqual([...profiles].sort());
    expect(chats.map((chat) => chat.otherEmployee.name).sort()).toEqual(
      ['Emp0 Paged', 'Emp1 Paged', 'Emp2 Paged', 'Emp3 Paged', 'Emp4 Paged'].sort()
    );
    expect(fake.searches().length).toBeGreaterThan(1);
  });
});

describe('get-employee-chats getConversationToken', () => {
  const clientWith = (getToken: () => Promise<{ token: string }>): Oystehr =>
    ({ conversation: { getToken } }) as unknown as Oystehr;

  it('returns the Twilio token when Conversations is configured', async () => {
    await expect(getConversationToken(clientWith(async () => ({ token: 'twilio-token' })))).resolves.toEqual({
      token: 'twilio-token',
    });
  });

  it('reports a project without Oystehr Conversations as a misconfigured environment instead of a 500', async () => {
    const notConfigured = Object.assign(new Error('Messaging Service is not yet configured for Conversations.'), {
      code: '4281',
    });

    const failure = await getConversationToken(clientWith(() => Promise.reject(notConfigured))).catch((error) => error);

    expect(isApiError(failure)).toBe(true);
    expect(failure.code).toBe(APIErrorCode.MISCONFIGURED_ENVIRONMENT);
    expect(failure.message).toContain('Oystehr Conversations is not configured');
  });

  it('passes other Conversations failures through unchanged', async () => {
    const forbidden = Object.assign(new Error('Forbidden'), { code: '4031' });

    await expect(getConversationToken(clientWith(() => Promise.reject(forbidden)))).rejects.toBe(forbidden);
  });
});
