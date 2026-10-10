import { Task } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  AD_HOC_REPORT_DEFAULT_MODEL,
  AdHocReportModel,
  GenerateAdHocReportInput,
  GenerateAdHocReportInputSchema,
} from 'utils/lib/types/adhoc/generation/generate.types';
import {
  ADHOC_GENERATE_OUTPUT_CODE,
  ADHOC_GENERATE_PARAMS_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
} from 'utils/lib/types/adhoc/generation/report-task';
import { APIError, isApiError } from 'utils/lib/types/errors';
import { generateAdHocReportCode } from '../../shared/adhoc-generate';
import { sendErrors } from '../../shared/errors';
import { wrapTaskHandler } from '../task/helpers';

// Runs the report-code generation started by generate-adhoc-report. A subscription zambda gets up to
// 900s, so slower models (Claude) have time an http zambda (27s) doesn't give them.

const ZAMBDA_NAME = 'sub-generate-adhoc-report';

function readParams(task: Task): GenerateAdHocReportInput {
  const raw = task.input?.find((i) => i.type?.coding?.some((c) => c.code === ADHOC_GENERATE_PARAMS_CODE))?.valueString;

  if (!raw) throw new Error('Ad-hoc generation Task is missing its params input');

  return GenerateAdHocReportInputSchema.parse(JSON.parse(raw));
}

// The Task's status reason reaches the browser (generate-adhoc-report polling), so only expected,
// user-readable failures keep their message; anything else is logged, reported to Sentry and shown as this.
export const UNEXPECTED_FAILURE_REASON = 'Internal error';

export const index = wrapTaskHandler(ZAMBDA_NAME, async ({ task, secrets }, oystehr) => {
  const startedAt = Date.now();
  let model: AdHocReportModel = AD_HOC_REPORT_DEFAULT_MODEL;

  try {
    const params = readParams(task);

    // The model was already resolved against the caller's roles when the Task was created.
    model = params.model ?? AD_HOC_REPORT_DEFAULT_MODEL;

    console.log(`[adhoc-generate] start task=${task.id} model=${model} repair=${!!params.previousAttempt}`);

    const result = await generateAdHocReportCode(params, model, secrets);

    await oystehr.fhir.patch({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        {
          op: 'add',
          path: '/output',
          value: [
            {
              type: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_GENERATE_OUTPUT_CODE }] },
              valueString: JSON.stringify(result),
            },
          ],
        },
      ],
    });
  } catch (error) {
    // The model could not produce a usable report: an expected outcome, no Sentry alert.
    if (isApiError(error)) return { taskStatus: 'failed' as const, statusReason: (error as APIError).message };

    console.error(`[adhoc-generate] failed task=${task.id} model=${model}`, error);
    await sendErrors(error, getSecret(SecretsKeys.ENVIRONMENT, secrets));

    return { taskStatus: 'failed' as const, statusReason: UNEXPECTED_FAILURE_REASON };
  }

  console.log(`[adhoc-generate] done task=${task.id} model=${model} ms=${Date.now() - startedAt}`);

  return { taskStatus: 'completed' as const, statusReason: 'Ad-hoc report generated' };
});
