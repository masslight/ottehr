import { APIGatewayProxyResult } from 'aws-lambda';
import { GetChartSectionResponse } from 'utils/lib/types/api/chart-data/chart-sections.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { buildChartSection } from '../../shared/chart-sections/registry';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;
const ZAMBDA_NAME = 'get-chart-section';

/**
 * Reads one section of a visit's chart. The section names a fixed set of fields whose FHIR searches live
 * on the server (shared/chart-sections); the caller supplies the encounter and the section name only.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  const { secrets, encounterId, section, params } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const data = await buildChartSection({ oystehr, m2mToken }, encounterId, section, params);
  const response: GetChartSectionResponse = { section, data };

  return {
    body: JSON.stringify(response),
    statusCode: 200,
  };
});
