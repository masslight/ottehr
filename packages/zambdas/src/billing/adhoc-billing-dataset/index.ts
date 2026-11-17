import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { ADHOC_BILLING_DATASET_TASK_CODE } from 'utils/lib/types/adhoc/generation/report-task';
import { AD_HOC_REPORT_VIEW_ROLES } from 'utils/lib/types/api/adhoc-report-access';
import { adHocReportTaskStatus, createAdHocReportTask } from '../../shared/adhoc-report';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'adhoc-billing-dataset';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  const { secrets } = params;

  await requireUserWithRole(getUserToken(input), secrets, AD_HOC_REPORT_VIEW_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  if ('taskId' in params) {
    const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: params.taskId });
    const body = await adHocReportTaskStatus(task, ADHOC_BILLING_DATASET_TASK_CODE, m2mToken);
    return { statusCode: 200, body: JSON.stringify(body) };
  }

  const task = await createAdHocReportTask(oystehr, ADHOC_BILLING_DATASET_TASK_CODE, params);

  return { statusCode: 200, body: JSON.stringify({ taskId: task.id }) };
});
