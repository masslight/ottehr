import { APIGatewayProxyResult } from 'aws-lambda';
import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  safeJsonParse,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { produceDischargeOutreach } from '../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'produce-outreach-discharge-tasks';

/**
 * Zambda handler: thin wrapper over produceDischargeOutreach.
 *
 * Input body: { encounterId: string }
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUIRED_PARAMETERS(['body']);
  if (!input.secrets) throw new Error('Secrets are not defined');

  const body = safeJsonParse(input.body);

  const encounterId = body.encounterId;
  if (!encounterId || typeof encounterId !== 'string') {
    throw INVALID_INPUT_ERROR('encounterId is required and must be a non-empty string');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  const result = await produceDischargeOutreach({
    encounterId,
    oystehr,
    validateStatus: true,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      discharge: { created: result.discharge.created.length, skipped: result.discharge.skipped.length },
      dateOfVisit: { created: result.dateOfVisit.created.length, skipped: result.dateOfVisit.skipped.length },
    }),
  };
});
