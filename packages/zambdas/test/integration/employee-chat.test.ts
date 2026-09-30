import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Encounter, Group, Practitioner } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { EMPLOYEE_CHAT_PAIR_SYSTEM } from 'utils/lib/types/api/employee-chat.types';
import { INTEGRATION_TEST_TAG_SYSTEM } from 'utils/lib/utils/e2eCleanup';
import { afterAll, assert, beforeAll, describe, expect, it, vi } from 'vitest';
import { listEmployeeChats } from '../../src/ehr/get-employee-chats';
import { resolveEmployeeChat } from '../../src/ehr/open-employee-chat/helpers';
import {
  buildPairGroup,
  pairKey,
  readConversationEncounter,
  readConversationSid,
  readPreviousConversations,
  reconcilePairGroups,
  selectCanonicalGroup,
  withConversation,
} from '../../src/ehr/shared/employee-chat';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

const resolveSid = async (...args: Parameters<typeof resolveEmployeeChat>): Promise<string> =>
  (await resolveEmployeeChat(...args)).conversationSid;

describe('employee chat pair resolution', () => {
  let oystehr: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  const practitioners: Record<'alice' | 'bob' | 'carol', string> = { alice: '', bob: '', carol: '' };
  const profiles: string[] = [];
  const encounterIds: string[] = [];
  let createSpy: ReturnType<typeof vi.spyOn>;
  let addParticipantSpy: ReturnType<typeof vi.spyOn>;
  let removeParticipantSpy: ReturnType<typeof vi.spyOn>;

  const tag = (): { tag: { system: string; code: string }[] } => ({
    tag: [{ system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }],
  });

  const groupsForPair = async (a: string, b: string): Promise<Group[]> =>
    (
      await oystehr.fhir.search<Group>({
        resourceType: 'Group',
        params: [{ name: 'identifier', value: `${EMPLOYEE_CHAT_PAIR_SYSTEM}|${pairKey(a, b)}` }],
      })
    ).unbundle();

  const createPractitioner = async (given: string): Promise<string> => {
    const practitioner = await oystehr.fhir.create<Practitioner>({
      resourceType: 'Practitioner',
      active: true,
      name: [{ given: [given], family: `EmpChat-${randomUUID().slice(0, 8)}` }],
      meta: tag(),
    });
    assert(practitioner.id);
    const profile = `Practitioner/${practitioner.id}`;
    profiles.push(profile);
    return profile;
  };

  const seedPairGroup = async (a: string, b: string, withSid: boolean): Promise<Group> => {
    const group = { ...buildPairGroup(a, b), meta: tag() };
    if (!withSid) {
      return oystehr.fhir.create<Group>(group);
    }
    const { encounter } = await oystehr.conversation.create({
      encounter: { resourceType: 'Encounter', status: 'in-progress', class: { code: 'VR' } },
    });
    const sid = oystehr.conversation.getConversationIdFromEncounter(encounter);
    assert(sid && encounter.id);
    return oystehr.fhir.create<Group>(withConversation(group, sid, encounter.id));
  };

  const groupVersions = async (a: string, b: string): Promise<Record<string, string | undefined>> =>
    Object.fromEntries((await groupsForPair(a, b)).map((group) => [group.id, group.meta?.versionId]));

  beforeAll(async () => {
    const setup = await setupIntegrationTest('employee-chat.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    cleanup = setup.cleanup;
    processId = setup.processId;

    for (const [key, given] of [
      ['alice', 'Alice'],
      ['bob', 'Bob'],
      ['carol', 'Carol'],
    ] as const) {
      practitioners[key] = await createPractitioner(given);
    }

    createSpy = vi.spyOn(oystehr.conversation, 'create').mockImplementation(async ({ encounter }) => {
      const created = await oystehr.fhir.create<Encounter>({
        ...(encounter as Encounter),
        meta: tag(),
        extension: [
          {
            url: oystehr.conversation.ENCOUNTER_VS_EXTENSION_URL,
            extension: [
              { url: oystehr.conversation.ENCOUNTER_VS_EXTENSION_RELATIVE_URL, valueString: `CH${randomUUID()}` },
            ],
          },
        ],
      });
      encounterIds.push(created.id!);
      return { encounter: created };
    });
    addParticipantSpy = vi.spyOn(oystehr.conversation, 'addParticipant').mockResolvedValue(undefined as never);
    removeParticipantSpy = vi.spyOn(oystehr.conversation, 'removeParticipant').mockResolvedValue(undefined as never);
  }, 60_000);

  afterAll(async () => {
    createSpy?.mockRestore();
    addParticipantSpy?.mockRestore();
    removeParticipantSpy?.mockRestore();
    for (const profile of profiles) {
      const groups = (
        await oystehr.fhir.search<Group>({
          resourceType: 'Group',
          params: [
            { name: 'member', value: profile },
            { name: '_count', value: '1000' },
          ],
        })
      ).unbundle();
      for (const group of groups) {
        await oystehr.fhir.delete({ resourceType: 'Group', id: group.id! }).catch(() => undefined);
      }
    }
    for (const id of encounterIds) {
      await oystehr.fhir.delete({ resourceType: 'Encounter', id }).catch(() => undefined);
    }
    for (const profile of profiles) {
      await oystehr.fhir.delete({ resourceType: 'Practitioner', id: profile.split('/')[1] }).catch(() => undefined);
    }
    await cleanup();
  });

  it('creates one Group and one conversation for a pair, with exactly the two participants', async () => {
    const { alice, bob } = practitioners;
    const sid = await resolveSid(oystehr, alice, bob);

    const groups = await groupsForPair(alice, bob);
    expect(groups).toHaveLength(1);
    expect(readConversationSid(groups[0])).toBe(sid);
    expect(groups[0].member?.map((member) => member.entity.reference).sort()).toEqual([alice, bob].sort());
    expect(addParticipantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: sid,
        participants: [
          { participantReference: alice, channel: 'chat' },
          { participantReference: bob, channel: 'chat' },
        ],
      })
    );
  });

  it('returns the same conversation for the reversed pair without creating another', async () => {
    const { alice, bob } = practitioners;
    const callsBefore = createSpy.mock.calls.length;
    const first = await resolveSid(oystehr, alice, bob);
    const reversed = await resolveSid(oystehr, bob, alice);

    expect(reversed).toBe(first);
    expect(createSpy.mock.calls.length).toBe(callsBefore);
  });

  it('creates a different conversation for a different pair', async () => {
    const { alice, bob, carol } = practitioners;
    const aliceBob = await resolveSid(oystehr, alice, bob);
    const aliceCarol = await resolveSid(oystehr, alice, carol);
    expect(aliceCarol).not.toBe(aliceBob);
  });

  it('converges concurrent first opens on one canonical Group and one stored conversation', async () => {
    const { bob, carol } = practitioners;
    const [fromBob, fromCarol] = await Promise.all([resolveSid(oystehr, bob, carol), resolveSid(oystehr, carol, bob)]);

    expect(fromBob).toBe(fromCarol);
    const pair = reconcilePairGroups(await groupsForPair(bob, carol), new Date().toISOString());
    expect(pair.changed).toBe(false);
    expect(readConversationSid(pair.canonical)).toBe(fromBob);
    expect(await resolveSid(oystehr, bob, carol)).toBe(fromBob);
  });

  it('converges repeated concurrent first opens for fresh pairs', async () => {
    for (let round = 0; round < 3; round++) {
      const [first, second] = [await createPractitioner('Racer'), await createPractitioner('Racer')];
      const sids = await Promise.all([
        resolveSid(oystehr, first, second),
        resolveSid(oystehr, second, first),
        resolveSid(oystehr, first, second),
      ]);

      expect(new Set(sids).size).toBe(1);
      const pair = reconcilePairGroups(await groupsForPair(first, second), new Date().toISOString());
      expect(pair.changed).toBe(false);
      expect(readConversationSid(pair.canonical)).toBe(sids[0]);
      const listed = await listEmployeeChats(oystehr, first);
      expect(listed.map((chat) => [chat.conversationSid, chat.otherEmployee.profile])).toEqual([[sids[0], second]]);
    }
  });

  it('heals a pair whose duplicate Groups hold different conversations without losing either', async () => {
    const [dave, erin] = [await createPractitioner('Dave'), await createPractitioner('Erin')];
    const seeded = [await seedPairGroup(dave, erin, true), await seedPairGroup(dave, erin, true)];
    const { canonical, duplicates } = selectCanonicalGroup(seeded);
    const kept = readConversationSid(canonical)!;
    const merged = readConversationSid(duplicates[0])!;
    const creationsBefore = createSpy.mock.calls.length;

    const healed = await resolveEmployeeChat(oystehr, erin, dave);

    expect(healed).toEqual({ conversationSid: kept, previousConversationSids: [merged] });
    const stored = await oystehr.fhir.get<Group>({ resourceType: 'Group', id: canonical.id! });
    expect(readConversationSid(stored)).toBe(kept);
    expect(readPreviousConversations(stored).map((retired) => retired.sid)).toEqual([merged]);
    const mergedEncounter = readConversationEncounter(duplicates[0])!.split('/')[1];
    expect((await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: mergedEncounter })).status).toBe(
      'finished'
    );
    expect(createSpy.mock.calls.length).toBe(creationsBefore);

    const before = await groupVersions(dave, erin);
    expect(await resolveEmployeeChat(oystehr, dave, erin)).toEqual(healed);
    expect(await resolveEmployeeChat(oystehr, erin, dave)).toEqual(healed);
    expect(await groupVersions(dave, erin)).toEqual(before);

    const daveChats = await listEmployeeChats(oystehr, dave);
    expect(daveChats).toHaveLength(1);
    expect(daveChats[0]).toMatchObject({ conversationSid: kept, previousConversationSids: [merged] });
    expect(daveChats[0].otherEmployee).toMatchObject({ profile: erin, firstName: 'Erin' });
  });

  it('keeps the only conversation of a duplicated pair current wherever it lives and lists the pair once', async () => {
    const [frank, gina] = [await createPractitioner('Frank'), await createPractitioner('Gina')];
    const empty = await seedPairGroup(frank, gina, false);
    const populated = await seedPairGroup(frank, gina, true);
    const sid = readConversationSid(populated)!;
    const creationsBefore = createSpy.mock.calls.length;

    expect((await listEmployeeChats(oystehr, gina)).map((chat) => chat.conversationSid)).toEqual([sid]);
    const resolved = await resolveEmployeeChat(oystehr, frank, gina);

    expect(resolved).toEqual({ conversationSid: sid, previousConversationSids: [] });
    const { canonical } = selectCanonicalGroup([empty, populated]);
    const stored = await oystehr.fhir.get<Group>({ resourceType: 'Group', id: canonical.id! });
    expect(readConversationSid(stored)).toBe(sid);
    expect(createSpy.mock.calls.length).toBe(creationsBefore);
    expect((await listEmployeeChats(oystehr, gina)).map((chat) => chat.conversationSid)).toEqual([sid]);
  });

  it('replaces a closed conversation once, keeps it as history and answers a stale request with the replacement', async () => {
    const { alice, bob } = practitioners;
    const closed = await resolveSid(oystehr, alice, bob);
    const removalsBefore = removeParticipantSpy.mock.calls.length;

    const replaced = await resolveEmployeeChat(oystehr, bob, alice, closed);
    const stale = await resolveEmployeeChat(oystehr, alice, bob, closed);

    expect(replaced.conversationSid).not.toBe(closed);
    expect(replaced.previousConversationSids).toEqual([closed]);
    expect(stale).toEqual(replaced);
    const [group] = await groupsForPair(alice, bob);
    expect(readConversationSid(group)).toBe(replaced.conversationSid);
    expect(readPreviousConversations(group).map((retired) => retired.sid)).toEqual([closed]);
    const retiredEncounter = readPreviousConversations(group)[0].encounter.split('/')[1];
    expect((await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: retiredEncounter })).status).toBe(
      'finished'
    );
    expect(removeParticipantSpy.mock.calls.length).toBe(removalsBefore);
  });

  it('converges concurrent replacements of the same closed conversation on one canonical conversation', async () => {
    const { alice, carol } = practitioners;
    const closed = await resolveSid(oystehr, alice, carol);

    const [fromAlice, fromCarol] = await Promise.all([
      resolveEmployeeChat(oystehr, alice, carol, closed),
      resolveEmployeeChat(oystehr, carol, alice, closed),
    ]);

    expect(fromAlice).toEqual(fromCarol);
    const [group] = await groupsForPair(alice, carol);
    expect(readConversationSid(group)).toBe(fromAlice.conversationSid);
    expect(readPreviousConversations(group).map((retired) => retired.sid)).toEqual([closed]);
    expect(
      removeParticipantSpy.mock.calls.some(
        (call: unknown[]) => (call[0] as { conversationId: string }).conversationId === closed
      )
    ).toBe(false);
  });

  it("lists only the caller's conversations with the other employee's name", async () => {
    const { alice, bob, carol } = practitioners;
    const aliceChats = await listEmployeeChats(oystehr, alice);
    expect(aliceChats.map((chat) => chat.otherEmployee.profile).sort()).toEqual([bob, carol].sort());
    expect(aliceChats.find((chat) => chat.otherEmployee.profile === bob)?.otherEmployee.firstName).toBe('Bob');

    const carolChats = await listEmployeeChats(oystehr, carol);
    expect(carolChats.map((chat) => chat.otherEmployee.profile).sort()).toEqual([alice, bob].sort());
    expect(carolChats.every((chat) => chat.otherEmployee.profile !== carol)).toBe(true);
  });
});
