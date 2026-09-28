import Oystehr from '@oystehr/sdk';
import { Encounter, FhirResource, Group, Practitioner } from 'fhir/r4b';
import { EMPLOYEE_CHAT_PAIR_SYSTEM } from 'utils/lib/types/api/employee-chat.types';
import { describe, expect, it } from 'vitest';
import { resolveEmployeeChat } from '../src/ehr/open-employee-chat/helpers';
import { validateRequestParameters } from '../src/ehr/open-employee-chat/validateRequestParameters';
import {
  buildPairGroup,
  otherMemberProfile,
  pairKey,
  readConversationSid,
  toSummary,
  withConversation,
} from '../src/ehr/shared/employee-chat';

const ALICE = 'Practitioner/1a1a1a1a-0000-0000-0000-000000000000';
const BOB = 'Practitioner/7c7c7c7c-0000-0000-0000-000000000000';
const CHARLIE = 'Practitioner/3f3f3f3f-0000-0000-0000-000000000000';

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
      otherEmployee: { profile: ALICE, firstName: 'Alice', lastName: 'Smith', name: 'Alice Smith' },
    });
  });

  it('replaces an existing conversation extension instead of duplicating it', () => {
    const group = withConversation(withConversation(buildPairGroup(ALICE, BOB), 'CH1', 'e1'), 'CH2', 'e2');
    expect(readConversationSid(group)).toBe('CH2');
    expect(group.extension).toHaveLength(2);
  });
});

describe('open-employee-chat validateRequestParameters', () => {
  const base = { headers: { Authorization: 'Bearer token' }, secrets: {} };

  it('accepts a Practitioner reference', () => {
    expect(validateRequestParameters({ ...base, body: JSON.stringify({ targetProfile: BOB }) }).targetProfile).toBe(
      BOB
    );
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

interface FakeFailures {
  addParticipant?: Error;
  removeParticipant?: Error;
  groupUpdate?: Error;
  groupUpdateAfterCommit?: Error;
  groupGet?: Error;
}

function createFakeOystehr(): {
  oystehr: Oystehr;
  groups: () => Group[];
  encounters: () => Encounter[];
  conversationsCreated: () => number;
  participantsAdded: () => string[][];
  participantsRemoved: () => { conversationId: string; participantReference: string }[];
  failures: FakeFailures;
} {
  const store = new Map<string, FhirResource>();
  let nextId = 0;
  let conversations = 0;
  const participants: string[][] = [];
  const removed: { conversationId: string; participantReference: string }[] = [];
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

  const conversation = {
    create: async ({ encounter }: { encounter: Encounter }) => {
      await tick();
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
    failures,
  };
}

describe('resolveEmployeeChat', () => {
  it('creates the pair Group and conversation with exactly the two participants', async () => {
    const fake = createFakeOystehr();
    const sid = await resolveEmployeeChat(fake.oystehr, ALICE, BOB);

    expect(fake.groups()).toHaveLength(1);
    expect(readConversationSid(fake.groups()[0])).toBe(sid);
    expect(fake.participantsAdded()).toEqual([[ALICE, BOB]]);
    expect(fake.encounters()[0].participant?.map((p) => p.individual?.reference)).toEqual([ALICE, BOB]);
    expect(fake.participantsRemoved()).toEqual([]);
  });

  it('returns the same conversation for the same pair in either order without creating another', async () => {
    const fake = createFakeOystehr();
    const first = await resolveEmployeeChat(fake.oystehr, ALICE, BOB);
    const second = await resolveEmployeeChat(fake.oystehr, BOB, ALICE);

    expect(second).toBe(first);
    expect(fake.conversationsCreated()).toBe(1);
    expect(fake.groups()).toHaveLength(1);
  });

  it('creates a different conversation for a different pair', async () => {
    const fake = createFakeOystehr();
    const aliceBob = await resolveEmployeeChat(fake.oystehr, ALICE, BOB);
    const aliceCharlie = await resolveEmployeeChat(fake.oystehr, ALICE, CHARLIE);

    expect(aliceCharlie).not.toBe(aliceBob);
    expect(fake.groups()).toHaveLength(2);
  });

  it('converges concurrent first opens on one stored conversation and cleans up only the losing one', async () => {
    const fake = createFakeOystehr();
    const [fromAlice, fromBob] = await Promise.all([
      resolveEmployeeChat(fake.oystehr, ALICE, BOB),
      resolveEmployeeChat(fake.oystehr, BOB, ALICE),
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

    await expect(resolveEmployeeChat(fake.oystehr, ALICE, BOB)).rejects.toBe(original);

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
    const retried = await resolveEmployeeChat(fake.oystehr, ALICE, BOB);
    expect(retried).toBe('CH2');
    expect(readConversationSid(fake.groups()[0])).toBe('CH2');
  });

  it('removes both employees and cancels the Encounter when storing the conversation on the Group fails', async () => {
    const fake = createFakeOystehr();
    const original = new Error('FHIR unavailable');
    fake.failures.groupUpdate = original;

    await expect(resolveEmployeeChat(fake.oystehr, ALICE, BOB)).rejects.toBe(original);

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

    const sid = await resolveEmployeeChat(fake.oystehr, ALICE, BOB);

    expect(readConversationSid(fake.groups()[0])).toBe(sid);
    expect(fake.participantsRemoved()).toEqual([]);
    expect(fake.encounters().map((encounter) => encounter.status)).toEqual(['in-progress']);

    fake.failures.groupUpdateAfterCommit = undefined;
    expect(await resolveEmployeeChat(fake.oystehr, BOB, ALICE)).toBe(sid);
    expect(fake.conversationsCreated()).toBe(1);
  });

  it('leaves the conversation in place and rethrows when the Group cannot be re-read after a failed write', async () => {
    const fake = createFakeOystehr();
    const original = new Error('Gateway Timeout');
    fake.failures.groupUpdateAfterCommit = original;
    fake.failures.groupGet = new Error('FHIR unavailable');

    await expect(resolveEmployeeChat(fake.oystehr, ALICE, BOB)).rejects.toBe(original);

    expect(fake.participantsRemoved()).toEqual([]);
    expect(fake.encounters().map((encounter) => encounter.status)).toEqual(['in-progress']);
  });

  it('keeps the original error when removing participants during cleanup also fails', async () => {
    const fake = createFakeOystehr();
    const original = new Error('User conversation limit exceeded');
    fake.failures.addParticipant = original;
    fake.failures.removeParticipant = new Error('Participant not found in the conversation.');

    await expect(resolveEmployeeChat(fake.oystehr, ALICE, BOB)).rejects.toBe(original);

    expect(fake.encounters().map((encounter) => encounter.status)).toEqual(['cancelled']);
  });
});
