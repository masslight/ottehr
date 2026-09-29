import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Group, Practitioner } from 'fhir/r4b';
import { EmployeeChatSummary, GetEmployeeChatsResponse } from 'utils/lib/types/api/employee-chat.types';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { EMPLOYEE_CHAT_CODE_QUERY, requireCallerPractitioner, toSummary } from '../shared/employee-chat';
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
  const resources = (
    await oystehr.fhir.search<Group | Practitioner>({
      resourceType: 'Group',
      params: [
        { name: 'code', value: EMPLOYEE_CHAT_CODE_QUERY },
        { name: 'member', value: myProfile },
        { name: '_include', value: 'Group:member' },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();

  const practitionersByProfile = new Map<string, Practitioner>();
  resources
    .filter((resource): resource is Practitioner => resource.resourceType === 'Practitioner')
    .forEach((practitioner) => practitionersByProfile.set(`Practitioner/${practitioner.id}`, practitioner));

  const summaries = new Map<string, EmployeeChatSummary>();
  resources
    .filter((resource): resource is Group => resource.resourceType === 'Group')
    .forEach((group) => {
      const summary = toSummary(group, practitionersByProfile, myProfile);
      if (summary && !summaries.has(summary.otherEmployee.profile)) {
        summaries.set(summary.otherEmployee.profile, summary);
      }
    });
  return [...summaries.values()];
}
