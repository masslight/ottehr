// The thin generic fetch zambda of the ad hoc reporting redesign: runs a saved / proposed fetch plan
// (a list of FHIR searches, some scoped to an earlier step's results) and hands the resources back with
// per-step timings. It knows nothing about any report — the report code runs on these resources in the
// browser sandbox. The runner itself lives in shared/adhoc-fetch-plan so the Task path can reuse it.
import { APIGatewayProxyResult } from 'aws-lambda';
import { RunFetchPlanOutput, RunFetchPlanOutputSchema } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { AD_HOC_REPORT_VIEW_ROLES } from 'utils/lib/types/api/adhoc-report-access';
import { runFetchPlan } from '../../shared/adhoc-fetch-plan';
import { uploadAdHocReportDataToZ3 } from '../../shared/adhoc-report';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateOutputWithSchema } from '../../shared/validate-zod';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'adhoc-fetch-plan';

// Lambda responses are capped at 6 MB; anything bigger goes through a Z3 file like today's reports.
const INLINE_RESPONSE_LIMIT_BYTES = 5 * 1024 * 1024;

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { plan, dateRange, parameters, inline, gzip, secrets } = validateRequestParameters(input);

  await requireUserWithRole(getUserToken(input), secrets, AD_HOC_REPORT_VIEW_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const { resources, stats, totalMs } = await runFetchPlan(oystehr, plan, dateRange, parameters);
  const json = JSON.stringify(resources);

  const base = { stats, totalMs, totalBytes: json.length, dateRange };
  const output: RunFetchPlanOutput =
    inline || json.length <= INLINE_RESPONSE_LIMIT_BYTES
      ? { ...base, resources }
      : { ...base, downloadUrl: await uploadAdHocReportDataToZ3(oystehr, secrets, m2mToken, json, gzip) };

  return {
    statusCode: 200,
    body: JSON.stringify(validateOutputWithSchema(RunFetchPlanOutputSchema, output, ZAMBDA_NAME)),
  };
});
