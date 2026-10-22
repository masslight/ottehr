// Runs a system report for the EHR viewer. The browser names the report; the plan is loaded from the
// system-report Basic here and run with the shared runner — directly when the report's last run on this
// practice was fast enough for the http_auth ceiling (fetch-mode.ts), else through the background Task
// path (`sub-adhoc-report`), the way Report Studio decides. Nothing a viewer sends is ever executed.
import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import {
  ADHOC_REPORT_PARAMS_CODE,
  ADHOC_REPORT_TASK_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
} from 'utils/lib/types/adhoc/generation/report-task';
import { planNeedsPatient } from 'utils/lib/types/adhoc/plan/fetch-plan';
import {
  RunSystemReportOutput,
  RunSystemReportOutputSchema,
  systemReportFetchMode,
} from 'utils/lib/types/adhoc/system/system-report';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { INLINE_RESPONSE_LIMIT_BYTES, runFetchPlan } from '../../shared/adhoc-fetch-plan';
import { uploadAdHocReportDataToZ3 } from '../../shared/adhoc-report';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import {
  findSystemReportBasic,
  parseSystemReportBasic,
  recordSystemReportMeasurement,
} from '../../shared/system-report';
import { ZambdaInput } from '../../shared/types/common';
import { validateOutputWithSchema } from '../../shared/validate-zod';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'run-system-report';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { reportId, dateRange, parameters, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // The id is searched under the system-report code, so a saved report's id (or any other Basic) is not found.
  const basic = await findSystemReportBasic(oystehr, reportId);
  const report = basic && parseSystemReportBasic(basic);
  if (!report) throw FHIR_RESOURCE_NOT_FOUND('Basic');
  // Each report names the roles that may run it.
  await requireUserWithRole(getUserToken(input), secrets, report.roles);
  if (!report.plan) throw INVALID_INPUT_ERROR('This report has no plan to run');
  if (planNeedsPatient(report.plan) && !parameters?.patientId) {
    throw INVALID_INPUT_ERROR('This report runs for one patient: parameters.patientId is required');
  }

  let output: RunSystemReportOutput;
  if (systemReportFetchMode(report, dateRange) === 'task') {
    // The same Task `adhoc-report` creates for a plan, plus the report id so the run's timing is recorded on it.
    const task = await oystehr.fhir.create<Task>({
      resourceType: 'Task',
      status: 'requested',
      intent: 'order',
      code: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_REPORT_TASK_CODE }] },
      input: [
        {
          type: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_REPORT_PARAMS_CODE }] },
          valueString: JSON.stringify({ plan: report.plan, dateRange, parameters, systemReportId: reportId }),
        },
      ],
    });
    output = { taskId: task.id! };
  } else {
    const { resources, stats, totalMs } = await runFetchPlan(oystehr, report.plan, dateRange, parameters);
    await recordSystemReportMeasurement(oystehr, reportId, totalMs, dateRange);
    const json = JSON.stringify(resources);
    const base = { stats, totalMs, totalBytes: json.length, dateRange };
    output =
      json.length <= INLINE_RESPONSE_LIMIT_BYTES
        ? { ...base, resources }
        : { ...base, downloadUrl: await uploadAdHocReportDataToZ3(oystehr, secrets, m2mToken, json) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(validateOutputWithSchema(RunSystemReportOutputSchema, output, ZAMBDA_NAME)),
  };
});
