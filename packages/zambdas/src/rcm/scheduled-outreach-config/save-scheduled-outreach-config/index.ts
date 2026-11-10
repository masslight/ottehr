import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { saveOutreachConfig } from '../save-outreach-config';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'save-scheduled-outreach-config',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const validated = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validated.secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, validated.secrets);

    const response = await saveOutreachConfig(oystehr, validated.actions, validated.notificationsTimeRestriction);
    return { statusCode: 200, body: JSON.stringify(response) };
  }
);
