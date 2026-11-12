import { APIGatewayProxyResult } from 'aws-lambda';
import { FlowsheetId, FlowsheetVisit, GetFlowsheetOutput } from 'utils/lib/types/api/flowsheets.types';
import { ALL_EHR_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { buildGrowthFlowsheet } from './growth';
import { buildVitalsFlowsheet } from './helpers';
import { buildLabResultsFlowsheet, LAB_RESULTS_DATA_KINDS } from './lab-results';
import { buildNewbornBilirubinFlowsheet, NEWBORN_BILIRUBIN_DATA_KINDS } from './newborn-bilirubin';
import { fetchFlowsheetData, FlowsheetData, FlowsheetDataKind } from './patient-data';
import { buildThyroidFlowsheet, THYROID_DATA_KINDS } from './thyroid';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-flowsheet';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

interface FlowsheetDefinition {
  /** The kinds of patient data this flowsheet needs; nothing else is fetched. */
  kinds: FlowsheetDataKind[];
  /** The visits, or the visits with the flowsheet's extra data (the growth charts), up to asOf. */
  build: (data: FlowsheetData, asOf?: string) => FlowsheetVisit[] | GetFlowsheetOutput;
}

// Every query is built from the patient id alone; the flowsheet id only picks the kinds of data to fetch.
const FLOWSHEETS: Record<FlowsheetId, FlowsheetDefinition> = {
  growth: {
    kinds: ['birthDate', 'vitals'],
    build: (data, asOf) => buildGrowthFlowsheet({ ...data, observations: data.vitals ?? [] }, asOf),
  },
  labResults: { kinds: LAB_RESULTS_DATA_KINDS, build: buildLabResultsFlowsheet },
  newbornBilirubin: { kinds: NEWBORN_BILIRUBIN_DATA_KINDS, build: buildNewbornBilirubinFlowsheet },
  thyroid: { kinds: THYROID_DATA_KINDS, build: buildThyroidFlowsheet },
  vitals: { kinds: ['vitals'], build: (data) => buildVitalsFlowsheet({ ...data, observations: data.vitals ?? [] }) },
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  // Authorization first, so an unauthenticated caller gets 401 whatever the body holds.
  await requireUserWithRole(getUserToken(input), input.secrets, ALL_EHR_STAFF_ROLES);
  const { patientId, flowsheetId, asOf, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const { kinds, build } = FLOWSHEETS[flowsheetId];
  const built = build(await fetchFlowsheetData(oystehr, patientId, kinds), asOf);
  const output: GetFlowsheetOutput = Array.isArray(built) ? { visits: built } : built;
  if (asOf) output.visits = output.visits.filter((visit) => Date.parse(visit.start) <= Date.parse(asOf));
  return { statusCode: 200, body: JSON.stringify(output) };
});
