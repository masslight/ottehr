import { Task } from 'fhir/r4b';
import {
  AD_HOC_REPORT_DEFAULT_MODEL,
  GenerateAdHocReportInput,
  GenerateAdHocReportInputSchema,
} from 'utils/lib/types/adhoc/generation/generate.types';
import {
  ADHOC_GENERATE_OUTPUT_CODE,
  ADHOC_GENERATE_PARAMS_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
} from 'utils/lib/types/adhoc/generation/report-task';
import { generateAdHocReportCode } from '../../shared/adhoc-generate';
import { wrapTaskHandler } from '../task/helpers';

// Runs the report-code generation started by generate-adhoc-report. A subscription zambda gets up to
// 900s, so slower models (Claude) have time an http zambda (27s) doesn't give them.

const ZAMBDA_NAME = 'sub-generate-adhoc-report';

function readParams(task: Task): GenerateAdHocReportInput {
  const raw = task.input?.find((i) => i.type?.coding?.some((c) => c.code === ADHOC_GENERATE_PARAMS_CODE))?.valueString;

  if (!raw) throw new Error('Ad-hoc generation Task is missing its params input');

  return GenerateAdHocReportInputSchema.parse(JSON.parse(raw));
}

export const index = wrapTaskHandler(ZAMBDA_NAME, async ({ task, secrets }, oystehr) => {
  const startedAt = Date.now();
  const params = readParams(task);

  // The model was already resolved against the caller's roles when the Task was created.
  const model = params.model ?? AD_HOC_REPORT_DEFAULT_MODEL;

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

  console.log(`[adhoc-generate] done task=${task.id} model=${model} ms=${Date.now() - startedAt}`);

  return { taskStatus: 'completed' as const, statusReason: 'Ad-hoc report generated' };
});
