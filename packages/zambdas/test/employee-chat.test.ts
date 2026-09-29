import Oystehr from '@oystehr/sdk';
import { Encounter, FhirResource, Group, Practitioner } from 'fhir/r4b';
import { EMPLOYEE_CHAT_PAIR_SYSTEM } from 'utils/lib/types/api/employee-chat.types';
import { APIErrorCode, isApiError } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import { getConversationToken } from '../src/ehr/get-employee-chats';
import { resolveEmployeeChat } from '../src/ehr/open-employee-chat/helpers';
import { validateRequestParameters } from '../src/ehr/open-employee-chat/validateRequestParameters';
import {
  buildPairGroup,
  otherMemberProfile,
  pairKey,
  readConversationEncounter,
  readConversationSid,
  readPreviousConversations,
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
}

function createFakeOystehr(): {
  oystehr: Oystehr;
  groups: () => Group[];
  encounters: () => Encounter[];
  conversationsCreated: () => number;
  participantsAdded: () => string[][];
  participantsRemoved: () => { conversationId: string; participantReference: string }[];
  removalAttempts: () => { conversationId: string; participantReference: string }[];
  failures: FakeFailures;
} {
  const store = new Map<string, FhirResource>();
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
    create: async (resource: FhirResource, options?: { ifNoneExist?: { name: string; value: string }[] }) => {
      await tick();
      const identifier = options?.ifNoneExist?.find((param) => param.name === 'identifier')?.value;
      if (identifier) {
        const match = [...store.values()].find(
          (candidate) =>
            candidate.resourceType === resource.resourceType &&
            (candidate as Group).identifier?.some((id) => `${id.system}|${id.value}` === identifier)
        );
        if (match) return structuredClone(match);
      }
      return save(resource);
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
    groups: () => all('Group') as Group[],
    encounters: () => all('Encounter') as Encounter[],
    conversationsCreated: () => conversations,
    participantsAdded: () => participants,
    participantsRemoved: () => removed,
    removalAttempts: () => removalAttempts,
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

  it('converges concurrent first opens on one stored conversation and cleans up only the losing one', async () => {
    const fake = createFakeOystehr();
    const [fromAlice, fromBob] = await Promise.all([
      resolveSid(fake.oystehr, ALICE, BOB),
      resolveSid(fake.oystehr, BOB, ALICE),
    ]);

    expect(fromAlice).toBe(fromBob);
    expect(fake.groups()).toHaveLength(1);
    expect(readConversationSid(fake.groups()[0])).toBe(fromAlice);
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
