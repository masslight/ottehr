import { APIGatewayProxyResult } from 'aws-lambda';
import { MISSING_REQUEST_SECRETS } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { getOrCreateOutreachConfig, parseNotificationsTimeRestriction, parsePlanDefinitionToActions } from '../helpers';

let m2mToken: string;
export const index = wrapHandler(
  'get-scheduled-outreach-config',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.secrets) throw MISSING_REQUEST_SECRETS;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createOystehrClient(m2mToken, input.secrets);

    const planDefinition = await getOrCreateOutreachConfig(oystehr);
    const actions = parsePlanDefinitionToActions(planDefinition);
    const notificationsTimeRestriction = parseNotificationsTimeRestriction(planDefinition);

    return {
      statusCode: 200,
      body: JSON.stringify({ planDefinition, actions, notificationsTimeRestriction }),
    };
  }
);
