// The weights and heights the Vitals page's growth charts are drawn from: every one recorded for the patient, across
// all visits. Any signed-in EHR staff user may load them, as for the vitals themselves.
import { APIGatewayProxyResult } from 'aws-lambda';
import { Observation } from 'fhir/r4b';
import {
  GetGrowthChartDataInputSchema,
  GetGrowthChartDataOutput,
} from 'utils/lib/types/api/chart-data/get-growth-chart-data.types';
import { ALL_EHR_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../../shared/auth';
import { fetchAllPages } from '../../../../shared/fhir';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateWithSchema } from '../../../../shared/validation';

const ZAMBDA_NAME = 'get-growth-chart-data';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, secrets } = validateWithSchema(GetGrowthChartDataInputSchema, input);

  await requireUserWithRole(getUserToken(input), secrets, ALL_EHR_STAFF_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const observations: Observation[] = [];
  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<Observation>({
      resourceType: 'Observation',
      params: [
        { name: 'patient', value: `Patient/${patientId}` },
        { name: '_tag', value: 'vital-weight,vital-height' },
        { name: '_elements', value: 'meta,value,encounter,effective' },
        { name: '_count', value: count.toString() },
        { name: '_offset', value: offset.toString() },
      ],
    });
    observations.push(...bundle.unbundle());
    return bundle;
  }, 1000);

  const output: GetGrowthChartDataOutput = { observations };
  return { statusCode: 200, body: JSON.stringify(output) };
});
