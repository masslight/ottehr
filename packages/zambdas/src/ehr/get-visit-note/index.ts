import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { buildVisitNote } from '../../shared/chart-sections/visit-note';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;
const ZAMBDA_NAME = 'get-visit-note';

/** Everything the visit note (Review & Sign, follow-up note) shows, in one read. */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  const { secrets, encounterId } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const visitNote = await buildVisitNote({ oystehr, m2mToken }, encounterId);

  return {
    body: JSON.stringify(visitNote),
    statusCode: 200,
  };
});
