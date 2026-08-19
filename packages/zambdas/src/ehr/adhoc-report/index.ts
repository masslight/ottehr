import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import {
  ADHOC_REPORT_OUTPUT_URL_CODE,
  ADHOC_REPORT_PARAMS_CODE,
  ADHOC_REPORT_TASK_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
  AdHocReportStatus,
} from 'utils/lib/types/adhoc/generation/report-task';
import { AD_HOC_REPORT_VIEW_ROLES } from 'utils/lib/types/api/adhoc-report-access';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createPresignedUrl } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'adhoc-report';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  const { secrets } = params;

  await requireUserWithRole(getUserToken(input), secrets, AD_HOC_REPORT_VIEW_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  if ('taskId' in params) {
    const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: params.taskId });
    const body = await buildStatusResponse(task, m2mToken);
    return { statusCode: 200, body: JSON.stringify(body) };
  }

  const task = await oystehr.fhir.create<Task>({
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    code: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_REPORT_TASK_CODE }] },
    input: [
      {
        type: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_REPORT_PARAMS_CODE }] },
        valueString: JSON.stringify({
          datasetId: params.datasetId,
          dateRange: params.dateRange,
          options: params.options ?? {},
        }),
      },
    ],
  });

  return { statusCode: 200, body: JSON.stringify({ taskId: task.id }) };
});

async function buildStatusResponse(task: Task, token: string): Promise<AdHocReportStatus> {
  if (task.status === 'completed') {
    const outputUrl = task.output?.find((o) => o.type?.coding?.some((c) => c.code === ADHOC_REPORT_OUTPUT_URL_CODE))
      ?.valueString;
    if (!outputUrl) return { status: 'failed', error: 'Report completed but produced no data file' };
    const downloadUrl = await createPresignedUrl(token, outputUrl, 'download');
    return { status: 'completed', downloadUrl };
  }

  const failed = ['failed', 'cancelled', 'rejected', 'entered-in-error'];
  if (failed.includes(task.status)) {
    return {
      status: 'failed',
      error: task.statusReason?.text || task.statusReason?.coding?.[0]?.code || 'Report failed',
    };
  }

  return { status: task.status === 'in-progress' ? 'in-progress' : 'requested' };
}
