import Oystehr from '@oystehr/sdk';
import { Encounter, Group } from 'fhir/r4b';
import { EMPLOYEE_CHAT_PAIR_SYSTEM } from 'utils/lib/types/api/employee-chat.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { errorHasStatusCode, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { getEmployees, getRoleMembers, getRoles } from '../../shared/users.helper';
import {
  buildPairGroup,
  conversationSidsOf,
  pairIdentifierQuery,
  pairKey,
  readConversationEncounter,
  readConversationSid,
  readPreviousConversations,
  ReconciledPairGroups,
  reconcilePairGroups,
  withConversation,
  withReplacement,
} from '../shared/employee-chat';

export interface ResolvedEmployeeChat {
  conversationSid: string;
  previousConversationSids: string[];
}

export async function assertActiveEmployee(oystehr: Oystehr, profile: string): Promise<void> {
  const [employees, roles] = await Promise.all([getEmployees(oystehr), getRoles(oystehr)]);
  if (!employees.some((employee) => employee.profile === profile)) {
    throw INVALID_INPUT_ERROR('Employee not found or inactive');
  }
  const inactiveRoleId = roles.find((role) => role.name === RoleType.Inactive)?.id;
  if (inactiveRoleId) {
    const inactiveMembers = await getRoleMembers(inactiveRoleId, oystehr);
    if (inactiveMembers.some((member) => member.profile === profile)) {
      throw INVALID_INPUT_ERROR('Employee not found or inactive');
    }
  }
}

const MAX_RESOLVE_ATTEMPTS = 6;

async function searchPairGroups(oystehr: Oystehr, callerProfile: string, targetProfile: string): Promise<Group[]> {
  return (
    await oystehr.fhir.search<Group>({
      resourceType: 'Group',
      params: [
        { name: 'identifier', value: pairIdentifierQuery(callerProfile, targetProfile) },
        { name: '_count', value: '100' },
      ],
    })
  ).unbundle();
}

async function findOrCreatePairGroups(
  oystehr: Oystehr,
  callerProfile: string,
  targetProfile: string
): Promise<Group[]> {
  const existing = await searchPairGroups(oystehr, callerProfile, targetProfile);
  if (existing.length > 0) return existing;
  const created = await oystehr.fhir.create<Group>(buildPairGroup(callerProfile, targetProfile));
  if (!created?.id) {
    throw new Error(
      `Creating the employee chat Group for ${pairKey(callerProfile, targetProfile)} returned no resource`
    );
  }
  const found = await searchPairGroups(oystehr, callerProfile, targetProfile);
  return found.some((group) => group.id === created.id) ? found : [...found, created];
}

async function writeGroup(oystehr: Oystehr, stored: Group, next: Group): Promise<boolean> {
  try {
    await oystehr.fhir.update<Group>(next, { optimisticLockingVersionId: stored.meta?.versionId });
    return true;
  } catch (error) {
    if (errorHasStatusCode(error, 412)) return false;
    throw error;
  }
}

async function createPairConversation(
  oystehr: Oystehr,
  callerProfile: string,
  targetProfile: string
): Promise<{ conversationSid: string; encounter: Encounter }> {
  const { encounter } = await oystehr.conversation.create({
    encounter: {
      resourceType: 'Encounter',
      status: 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'VR',
        display: 'virtual',
      },
      identifier: [{ system: EMPLOYEE_CHAT_PAIR_SYSTEM, value: pairKey(callerProfile, targetProfile) }],
      participant: [{ individual: { reference: callerProfile } }, { individual: { reference: targetProfile } }],
    },
  });
  const conversationSid = oystehr.conversation.getConversationIdFromEncounter(encounter);
  if (!encounter.id || !conversationSid) {
    throw new Error('Oystehr created an employee chat conversation without an Encounter id or conversation id');
  }
  try {
    await oystehr.conversation.addParticipant({
      encounterReference: `Encounter/${encounter.id}`,
      conversationId: conversationSid,
      participants: [
        { participantReference: callerProfile, channel: 'chat' },
        { participantReference: targetProfile, channel: 'chat' },
      ],
    });
  } catch (error) {
    console.error(`Adding employee chat participants to candidate conversation ${conversationSid} failed`, error);
    const possiblyAdded = isAccessDenied(error) ? [] : [callerProfile, targetProfile];
    await discardOrphanConversation(oystehr, encounter, conversationSid, possiblyAdded);
    throw error;
  }
  return { conversationSid, encounter };
}

function isAccessDenied(error: unknown): boolean {
  return String((error as { code?: unknown } | undefined)?.code) === '4031';
}

async function cancelOrphanEncounter(oystehr: Oystehr, encounter: Encounter): Promise<void> {
  try {
    await oystehr.fhir.update<Encounter>({ ...encounter, status: 'cancelled' });
  } catch (error) {
    console.error(`Failed to cancel orphan employee chat Encounter/${encounter.id}`, error);
  }
}

async function discardOrphanConversation(
  oystehr: Oystehr,
  encounter: Encounter,
  conversationSid: string,
  profiles: string[]
): Promise<void> {
  const removals = await Promise.all(
    profiles.map(async (participantReference) => {
      try {
        await oystehr.conversation.removeParticipant({
          encounterReference: `Encounter/${encounter.id}`,
          conversationId: conversationSid,
          participantReference,
        });
        return true;
      } catch (error) {
        console.error(
          `Failed to remove ${participantReference} from orphan employee chat conversation ${conversationSid}`,
          error
        );
        return false;
      }
    })
  );
  await cancelOrphanEncounter(oystehr, encounter);
  const failed = removals.filter((removed) => !removed).length;
  if (failed > 0) {
    console.error(
      `Orphan employee chat conversation ${conversationSid} still has ${failed} participant(s); ` +
        `Encounter/${encounter.id} is cancelled and no Group references the conversation`
    );
  }
}

function resolvedFrom(group: Group): ResolvedEmployeeChat | undefined {
  const conversationSid = readConversationSid(group);
  if (!conversationSid) return undefined;
  return {
    conversationSid,
    previousConversationSids: readPreviousConversations(group).map((retired) => retired.sid),
  };
}

async function finishRetiredEncounter(oystehr: Oystehr, reference: string | undefined): Promise<void> {
  const id = reference?.startsWith('Encounter/') ? reference.slice('Encounter/'.length) : undefined;
  if (!id) return;
  try {
    const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id });
    if (encounter.status === 'finished') return;
    await oystehr.fhir.update<Encounter>({ ...encounter, status: 'finished' });
  } catch (error) {
    console.error(`Failed to finish retired employee chat Encounter/${id}`, error);
  }
}

interface CandidateConversation {
  conversationSid: string;
  encounter: Encounter;
  keep: boolean;
  replacedEncounter?: string;
}

async function storeCandidate(
  oystehr: Oystehr,
  group: Group,
  next: Group,
  candidate: CandidateConversation
): Promise<boolean> {
  try {
    return await writeGroup(oystehr, group, next);
  } catch (error) {
    let stored: Group;
    try {
      stored = await oystehr.fhir.get<Group>({ resourceType: 'Group', id: group.id! });
    } catch (readError) {
      candidate.keep = true;
      console.error(
        `Failed to re-read employee chat Group/${group.id} after a failed write, leaving conversation ${candidate.conversationSid} in place`,
        readError
      );
      throw error;
    }
    if (readConversationSid(stored) === candidate.conversationSid) {
      console.log(`Employee chat Group/${group.id} write reported an error but stored ${candidate.conversationSid}`);
      return true;
    }
    throw error;
  }
}

async function absorbDuplicates(oystehr: Oystehr, pair: ReconciledPairGroups): Promise<void> {
  if (!(await writeGroup(oystehr, pair.canonical, pair.reconciled))) return;
  console.log(
    `Absorbed duplicate employee chat Groups into Group/${pair.canonical.id}` +
      (pair.retired.length ? `, retiring ${pair.retired.map((retired) => retired.sid).join(', ')}` : '')
  );
  await Promise.all(pair.retired.map((retired) => finishRetiredEncounter(oystehr, retired.encounter)));
}

export async function resolveEmployeeChat(
  oystehr: Oystehr,
  callerProfile: string,
  targetProfile: string,
  replaceClosedConversationSid?: string
): Promise<ResolvedEmployeeChat> {
  let candidate: CandidateConversation | undefined;
  let seen: Group[] = [];
  try {
    for (let attempt = 1; attempt <= MAX_RESOLVE_ATTEMPTS; attempt++) {
      seen = await findOrCreatePairGroups(oystehr, callerProfile, targetProfile);
      const pair = reconcilePairGroups(seen, new Date().toISOString());
      if (pair.changed) {
        await absorbDuplicates(oystehr, pair);
        continue;
      }

      const group = pair.canonical;
      const current = resolvedFrom(group);
      if (current && current.conversationSid !== replaceClosedConversationSid) {
        if (candidate?.conversationSid === current.conversationSid) {
          await finishRetiredEncounter(oystehr, candidate.replacedEncounter);
        }
        return current;
      }

      candidate ??= { ...(await createPairConversation(oystehr, callerProfile, targetProfile)), keep: false };
      candidate.replacedEncounter = current ? readConversationEncounter(group) : undefined;
      const next = current
        ? withReplacement(group, candidate.conversationSid, candidate.encounter.id!, new Date().toISOString())
        : withConversation(group, candidate.conversationSid, candidate.encounter.id!);
      if (await storeCandidate(oystehr, group, next, candidate)) {
        candidate.keep = true;
      }
    }
    throw new Error(
      `Employee chat for ${pairKey(callerProfile, targetProfile)} did not settle after ${MAX_RESOLVE_ATTEMPTS} attempts`
    );
  } finally {
    if (
      candidate &&
      !candidate.keep &&
      !seen.some((group) => conversationSidsOf(group).includes(candidate!.conversationSid))
    ) {
      await discardOrphanConversation(oystehr, candidate.encounter, candidate.conversationSid, [
        callerProfile,
        targetProfile,
      ]);
    }
  }
}
