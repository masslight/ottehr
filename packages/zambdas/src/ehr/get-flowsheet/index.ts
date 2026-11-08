import { APIGatewayProxyResult } from 'aws-lambda';
import { FlowsheetId, FlowsheetVisit, GetFlowsheetOutput } from 'utils/lib/types/api/flowsheets.types';
import { ALL_EHR_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { buildGrowthFlowsheet } from './growth';
import { buildVitalsFlowsheet } from './helpers';
import { fetchFlowsheetData, FlowsheetData, FlowsheetDataKind } from './patient-data';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-flowsheet';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

interface FlowsheetDefinition {
  /** The kinds of patient data this flowsheet needs; nothing else is fetched. */
  kinds: FlowsheetDataKind[];
  build: (data: FlowsheetData) => FlowsheetVisit[];
}

// Every query is built from the patient id alone; the flowsheet id only picks the kinds of data to fetch.
const FLOWSHEETS: Record<FlowsheetId, FlowsheetDefinition> = {
  vitals: { kinds: ['vitals'], build: (data) => buildVitalsFlowsheet({ ...data, observations: data.vitals ?? [] }) },
  growth: {
    kinds: ['birthDate', 'vitals'],
    build: (data) => buildGrowthFlowsheet({ ...data, observations: data.vitals ?? [] }),
  },
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  // Authorization first, so an unauthenticated caller gets 401 whatever the body holds.
  await requireUserWithRole(getUserToken(input), input.secrets, ALL_EHR_STAFF_ROLES);
  const { patientId, flowsheetId, asOf, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const { kinds, build } = FLOWSHEETS[flowsheetId];
  const visits = build(await fetchFlowsheetData(oystehr, patientId, kinds));
  const output: GetFlowsheetOutput = {
    visits: asOf ? visits.filter((visit) => Date.parse(visit.start) <= Date.parse(asOf)) : visits,
  };
  return { statusCode: 200, body: JSON.stringify(output) };
});
