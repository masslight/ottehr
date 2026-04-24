import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { getOrCreateDunningConfig, parsePlanDefinitionToActions, parseSmsTimeRestriction } from '../helpers';

let m2mToken: string;
export const index = wrapHandler('get-dunning-config', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw new Error('Secrets are not defined');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  const planDefinition = await getOrCreateDunningConfig(oystehr);
  const actions = parsePlanDefinitionToActions(planDefinition);
  const smsTimeRestriction = parseSmsTimeRestriction(planDefinition);

  return {
    statusCode: 200,
    body: JSON.stringify({ planDefinition, actions, smsTimeRestriction }),
  };
});
