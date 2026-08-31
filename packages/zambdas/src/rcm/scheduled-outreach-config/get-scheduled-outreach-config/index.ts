import { APIGatewayProxyResult } from 'aws-lambda';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { getOrCreateOutreachConfig, parseNotificationsTimeRestriction, parsePlanDefinitionToActions } from '../helpers';

let m2mToken: string;
export const index = wrapHandler(
  'get-scheduled-outreach-config',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.secrets) throw MISSING_REQUEST_SECRETS;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);

    const planDefinition = await getOrCreateOutreachConfig(oystehr);
    const actions = parsePlanDefinitionToActions(planDefinition);
    const notificationsTimeRestriction = parseNotificationsTimeRestriction(planDefinition);

    return {
      statusCode: 200,
      body: JSON.stringify({ planDefinition, actions, notificationsTimeRestriction }),
    };
  }
);
