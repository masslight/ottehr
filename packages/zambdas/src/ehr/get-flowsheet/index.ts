import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FlowsheetId, FlowsheetVisit, GetFlowsheetOutput } from 'utils/lib/types/api/flowsheets.types';
import { ALL_EHR_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { fetchVitalsFlowsheet } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-flowsheet';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

// Every query is built here from the patient id alone; the flowsheet id only picks the fetcher.
const FETCHERS: Record<FlowsheetId, (oystehr: Oystehr, patientId: string) => Promise<FlowsheetVisit[]>> = {
  vitals: fetchVitalsFlowsheet,
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  // Authorization first, so an unauthenticated caller gets 401 whatever the body holds.
  await requireUserWithRole(getUserToken(input), input.secrets, ALL_EHR_STAFF_ROLES);
  const { patientId, flowsheetId, asOf, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const visits = await FETCHERS[flowsheetId](oystehr, patientId);
  const output: GetFlowsheetOutput = {
    visits: asOf ? visits.filter((visit) => Date.parse(visit.start) <= Date.parse(asOf)) : visits,
  };
  return { statusCode: 200, body: JSON.stringify(output) };
});
