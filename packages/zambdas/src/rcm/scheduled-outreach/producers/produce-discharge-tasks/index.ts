import { APIGatewayProxyResult } from 'aws-lambda';
import { MISSING_REQUIRED_PARAMETERS } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../../shared';
import { produceDischargeOutreach } from '../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'produce-outreach-discharge-tasks';

/**
 * Zambda handler: thin wrapper over produceDischargeOutreach.
 *
 * Input body: Encounter resource or { encounterId: string }
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUIRED_PARAMETERS(['body']);
  if (!input.secrets) throw new Error('Secrets are not defined');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  const body = JSON.parse(input.body);

  const result = await produceDischargeOutreach({
    encounter: body.resourceType === 'Encounter' ? body : undefined,
    encounterId: body.encounterId,
    oystehr,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      discharge: { created: result.discharge.created.length, skipped: result.discharge.skipped.length },
      dateOfVisit: { created: result.dateOfVisit.created.length, skipped: result.dateOfVisit.skipped.length },
    }),
  };
});
