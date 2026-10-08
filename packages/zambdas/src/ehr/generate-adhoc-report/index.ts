import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import {
  AD_HOC_REPORT_DEFAULT_MODEL,
  AdHocGenerationStatus,
  GenerateAdHocReportInput,
  GenerateAdHocReportOutputSchema,
} from 'utils/lib/types/adhoc/generation/generate.types';
import {
  ADHOC_GENERATE_OUTPUT_CODE,
  ADHOC_GENERATE_PARAMS_CODE,
  ADHOC_GENERATE_TASK_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
} from 'utils/lib/types/adhoc/generation/report-task';
import { AD_HOC_REPORT_EDIT_ROLES, AD_HOC_REPORT_MODEL_PICKER_ROLES } from 'utils/lib/types/api/adhoc-report-access';
import { RoleType } from 'utils/lib/types/api/user.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

// Generation can outlast an http zambda's 27s limit, so this endpoint only starts a Task (which
// sub-generate-adhoc-report picks up) and reports its status; the client polls with { taskId }.

const ZAMBDA_NAME = 'generate-adhoc-report';

let m2mToken: string;

const hasTaskCode = (task: Task, code: string): boolean =>
  task.code?.coding?.some((c) => c.system === ADHOC_REPORT_TASK_SYSTEM && c.code === code) ?? false;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  const { secrets } = params;

  const user = await requireUserWithRole(getUserToken(input), secrets, AD_HOC_REPORT_EDIT_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  if ('taskId' in params) {
    const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: params.taskId });

    if (!hasTaskCode(task, ADHOC_GENERATE_TASK_CODE)) {
      throw INVALID_INPUT_ERROR(`Task ${params.taskId} is not an ad-hoc report generation task`);
    }

    const body: AdHocGenerationStatus = buildStatusResponse(task);

    return { statusCode: 200, body: JSON.stringify(body) };
  }

  const { secrets: _secrets, model: requestedModel, ...generateInput } = params;

  const canPickModel =
    user.roles?.some((role) => AD_HOC_REPORT_MODEL_PICKER_ROLES.includes(role.name as RoleType)) ?? false;

  // The role is checked here: the subscription trusts the model stored on the Task.
  const model = (canPickModel && requestedModel) || AD_HOC_REPORT_DEFAULT_MODEL;

  const taskParams: GenerateAdHocReportInput = { ...generateInput, model };

  const task = await oystehr.fhir.create<Task>({
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    code: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_GENERATE_TASK_CODE }] },
    input: [
      {
        type: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_GENERATE_PARAMS_CODE }] },
        valueString: JSON.stringify(taskParams),
      },
    ],
  });

  console.log(`${ZAMBDA_NAME}: started task=${task.id} model=${model}`);

  return { statusCode: 200, body: JSON.stringify({ taskId: task.id }) };
});

function buildStatusResponse(task: Task): AdHocGenerationStatus {
  if (task.status === 'completed') {
    const output = task.output?.find((o) => o.type?.coding?.some((c) => c.code === ADHOC_GENERATE_OUTPUT_CODE))
      ?.valueString;

    const parsed = output ? GenerateAdHocReportOutputSchema.safeParse(JSON.parse(output)) : undefined;

    if (!parsed?.success) return { status: 'failed', error: 'Report generation completed but produced no report' };

    return { status: 'completed', result: parsed.data };
  }

  const failed = ['failed', 'cancelled', 'rejected', 'entered-in-error'];

  if (failed.includes(task.status)) {
    return {
      status: 'failed',
      error: task.statusReason?.text || task.statusReason?.coding?.[0]?.code || 'Report generation failed',
    };
  }

  return { status: task.status === 'in-progress' ? 'in-progress' : 'requested' };
}
