import Oystehr from '@oystehr/sdk';
import { Encounter, Group } from 'fhir/r4b';
import { EMPLOYEE_CHAT_PAIR_SYSTEM } from 'utils/lib/types/api/employee-chat.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { errorHasStatusCode, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { getEmployees, getRoleMembers, getRoles } from '../../shared/users.helper';
import {
  buildPairGroup,
  pairIdentifierQuery,
  pairKey,
  readConversationEncounter,
  readConversationSid,
  readPreviousConversations,
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

async function findOrCreatePairGroup(oystehr: Oystehr, callerProfile: string, targetProfile: string): Promise<Group> {
  const group = await oystehr.fhir.create<Group>(buildPairGroup(callerProfile, targetProfile), {
    ifNoneExist: [{ name: 'identifier', value: pairIdentifierQuery(callerProfile, targetProfile) }],
  });
  if (!group?.id) {
    throw new Error(
      `Conditional create of the employee chat Group for ${pairKey(callerProfile, targetProfile)} returned no resource`
    );
  }
  return group;
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

async function commitConversation(
  oystehr: Oystehr,
  group: Group,
  updated: Group,
  created: { conversationSid: string; encounter: Encounter },
  profiles: string[]
): Promise<ResolvedEmployeeChat> {
  const { conversationSid, encounter } = created;
  try {
    await oystehr.fhir.update<Group>(updated, { optimisticLockingVersionId: group.meta?.versionId });
    return resolvedFrom(updated)!;
  } catch (error) {
    let stored: Group;
    try {
      stored = await oystehr.fhir.get<Group>({ resourceType: 'Group', id: group.id! });
    } catch (readError) {
      console.error(
        `Failed to re-read employee chat Group/${group.id} after a failed write, leaving conversation ${conversationSid} in place`,
        readError
      );
      throw error;
    }
    const storedChat = resolvedFrom(stored);
    if (storedChat?.conversationSid === conversationSid) {
      console.log(`Employee chat Group/${group.id} write reported an error but stored ${conversationSid}`);
      return storedChat;
    }
    await discardOrphanConversation(oystehr, encounter, conversationSid, profiles);
    if (!errorHasStatusCode(error, 412)) {
      throw error;
    }
    if (!storedChat) {
      throw new Error(`Employee chat Group/${group.id} changed concurrently but holds no conversation`);
    }
    console.log(`Employee chat Group/${group.id} was committed concurrently, using the stored conversation`);
    return storedChat;
  }
}

export async function resolveEmployeeChat(
  oystehr: Oystehr,
  callerProfile: string,
  targetProfile: string,
  replaceClosedConversationSid?: string
): Promise<ResolvedEmployeeChat> {
  const group = await findOrCreatePairGroup(oystehr, callerProfile, targetProfile);
  const current = resolvedFrom(group);
  if (current && current.conversationSid !== replaceClosedConversationSid) {
    return current;
  }

  const created = await createPairConversation(oystehr, callerProfile, targetProfile);
  const updated = current
    ? withReplacement(group, created.conversationSid, created.encounter.id!, new Date().toISOString())
    : withConversation(group, created.conversationSid, created.encounter.id!);
  const committed = await commitConversation(oystehr, group, updated, created, [callerProfile, targetProfile]);

  if (current && committed.conversationSid === created.conversationSid) {
    await finishRetiredEncounter(oystehr, readConversationEncounter(group));
  }
  return committed;
}
