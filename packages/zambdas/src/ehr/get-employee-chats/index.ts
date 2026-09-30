import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Group, Practitioner } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { EmployeeChatSummary, GetEmployeeChatsResponse } from 'utils/lib/types/api/employee-chat.types';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  EMPLOYEE_CHAT_CODE_QUERY,
  otherMemberProfile,
  reconcilePairGroups,
  requireCallerPractitioner,
  toSummary,
} from '../shared/employee-chat';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('get-employee-chats', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, userToken } = validateRequestParameters(input);
  const myProfile = await requireCallerPractitioner(userToken, secrets);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const [conversations, { token }] = await Promise.all([
    listEmployeeChats(oystehr, myProfile),
    getConversationToken(createClinicalOystehrClient(userToken, secrets)),
  ]);

  const response: GetEmployeeChatsResponse = { token, conversations };
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

const CONVERSATIONS_NOT_CONFIGURED = '4281';

export async function getConversationToken(oystehr: Oystehr): Promise<{ token: string }> {
  try {
    return await oystehr.conversation.getToken();
  } catch (error) {
    if (String((error as { code?: unknown } | undefined)?.code) === CONVERSATIONS_NOT_CONFIGURED) {
      throw MISCONFIGURED_ENVIRONMENT_ERROR(
        'Oystehr Conversations is not configured for this project, so employee chat is unavailable'
      );
    }
    throw error;
  }
}

export async function listEmployeeChats(oystehr: Oystehr, myProfile: string): Promise<EmployeeChatSummary[]> {
  const resources = await getAllFhirSearchPages<Group | Practitioner>(
    {
      resourceType: 'Group',
      params: [
        { name: 'code', value: EMPLOYEE_CHAT_CODE_QUERY },
        { name: 'member', value: myProfile },
        { name: '_include', value: 'Group:member' },
      ],
    },
    oystehr
  );

  const practitionersByProfile = new Map<string, Practitioner>();
  resources
    .filter((resource): resource is Practitioner => resource.resourceType === 'Practitioner')
    .forEach((practitioner) => practitionersByProfile.set(`Practitioner/${practitioner.id}`, practitioner));

  const groupsByPair = new Map<string, Group[]>();
  resources
    .filter((resource): resource is Group => resource.resourceType === 'Group')
    .forEach((group) => {
      const otherProfile = otherMemberProfile(group, myProfile);
      if (!otherProfile) return;
      groupsByPair.set(otherProfile, [...(groupsByPair.get(otherProfile) ?? []), group]);
    });

  const retiredAt = new Date().toISOString();
  return [...groupsByPair.values()].flatMap((groups) => {
    const summary = toSummary(reconcilePairGroups(groups, retiredAt).reconciled, practitionersByProfile, myProfile);
    return summary ? [summary] : [];
  });
}
