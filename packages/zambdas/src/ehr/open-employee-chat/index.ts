import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import { OpenEmployeeChatResponse } from 'utils/lib/types/api/employee-chat.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { buildSummary, practitionerIdFromProfile, requireCallerPractitioner } from '../shared/employee-chat';
import { assertActiveEmployee, resolveEmployeeChat } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('open-employee-chat', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { targetProfile, replaceClosedConversationSid, secrets, userToken } = validateRequestParameters(input);
  const callerProfile = await requireCallerPractitioner(userToken, secrets);
  if (callerProfile === targetProfile) {
    throw INVALID_INPUT_ERROR('Cannot start a chat with yourself');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  await assertActiveEmployee(oystehr, targetProfile);
  const { conversationSid, previousConversationSids } = await resolveEmployeeChat(
    oystehr,
    callerProfile,
    targetProfile,
    replaceClosedConversationSid
  );

  const targetPractitioner = await oystehr.fhir.get<Practitioner>({
    resourceType: 'Practitioner',
    id: practitionerIdFromProfile(targetProfile),
  });
  const response: OpenEmployeeChatResponse = {
    conversation: buildSummary(conversationSid, targetProfile, targetPractitioner, previousConversationSids),
  };
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
