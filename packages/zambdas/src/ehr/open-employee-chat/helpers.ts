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
  readConversationSid,
  withConversation,
} from '../shared/employee-chat';

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
  await oystehr.conversation.addParticipant({
    encounterReference: `Encounter/${encounter.id}`,
    conversationId: conversationSid,
    participants: [
      { participantReference: callerProfile, channel: 'chat' },
      { participantReference: targetProfile, channel: 'chat' },
    ],
  });
  return { conversationSid, encounter };
}

async function cancelOrphanEncounter(oystehr: Oystehr, encounter: Encounter): Promise<void> {
  try {
    await oystehr.fhir.update<Encounter>({ ...encounter, status: 'cancelled' });
  } catch (error) {
    console.error(`Failed to cancel orphan employee chat Encounter/${encounter.id}`, error);
  }
}

export async function resolveEmployeeChat(
  oystehr: Oystehr,
  callerProfile: string,
  targetProfile: string
): Promise<string> {
  const group = await findOrCreatePairGroup(oystehr, callerProfile, targetProfile);
  const existingSid = readConversationSid(group);
  if (existingSid) {
    return existingSid;
  }

  const { conversationSid, encounter } = await createPairConversation(oystehr, callerProfile, targetProfile);

  try {
    await oystehr.fhir.update<Group>(withConversation(group, conversationSid, encounter.id!), {
      optimisticLockingVersionId: group.meta?.versionId,
    });
    return conversationSid;
  } catch (error) {
    if (!errorHasStatusCode(error, 412)) {
      throw error;
    }
    console.log(`Employee chat Group/${group.id} was committed concurrently, using the stored conversation`);
    await cancelOrphanEncounter(oystehr, encounter);
    const current = await oystehr.fhir.get<Group>({ resourceType: 'Group', id: group.id! });
    const committedSid = readConversationSid(current);
    if (!committedSid) {
      throw new Error(`Employee chat Group/${group.id} changed concurrently but holds no conversation`);
    }
    return committedSid;
  }
}
