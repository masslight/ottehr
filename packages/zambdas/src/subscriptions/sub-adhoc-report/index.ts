import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import {
  AdHocBillingInputSchema,
  AdHocBillingOutputSchema,
  BILLING_LAYERS,
} from 'utils/lib/types/adhoc/datasets/billing';
import { layerIncludeFlags } from 'utils/lib/types/adhoc/datasets/dataset';
import {
  AdHocEncountersInputSchema,
  AdHocEncountersOutputSchema,
  ENCOUNTER_LAYERS,
} from 'utils/lib/types/adhoc/datasets/encounters';
import {
  AdHocPatientsInputSchema,
  AdHocPatientsOutputSchema,
  PATIENT_LAYERS,
} from 'utils/lib/types/adhoc/datasets/patients';
import {
  ADHOC_REPORT_OUTPUT_URL_CODE,
  ADHOC_REPORT_PARAMS_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
} from 'utils/lib/types/adhoc/generation/report-task';
import { fetchAdHocBillingRows } from '../../shared/adhoc-datasets/billing';
import { fetchAdHocEncounterRows } from '../../shared/adhoc-datasets/encounters';
import { fetchAdHocPatientRows } from '../../shared/adhoc-datasets/patients';
import { beginReportBudget, uploadAdHocReportJsonToZ3 } from '../../shared/adhoc-report';
import { validateOutputWithSchema } from '../../shared/validate-zod';
import { wrapTaskHandler } from '../task/helpers';

const ZAMBDA_NAME = 'sub-adhoc-report';

interface ReportParams {
  datasetId: string;
  dateRange: { start: string; end: string };
  options: Record<string, boolean>;
}

function readParams(task: Task): ReportParams {
  const raw = task.input?.find((i) => i.type?.coding?.some((c) => c.code === ADHOC_REPORT_PARAMS_CODE))?.valueString;
  if (!raw) throw new Error('Ad-hoc report Task is missing its params input');
  return JSON.parse(raw) as ReportParams;
}

async function buildOutputJson(oystehr: Oystehr, params: ReportParams): Promise<{ json: string; rowCount: number }> {
  const { datasetId, dateRange, options } = params;
  switch (datasetId) {
    case 'encounters-comprehensive': {
      const input = AdHocEncountersInputSchema.parse({ dateRange, ...layerIncludeFlags(ENCOUNTER_LAYERS, options) });
      const rows = await fetchAdHocEncounterRows(oystehr, input);
      const json = JSON.stringify(
        validateOutputWithSchema(AdHocEncountersOutputSchema, { encounters: rows }, ZAMBDA_NAME)
      );
      return { json, rowCount: rows.length };
    }
    case 'patients': {
      const input = AdHocPatientsInputSchema.parse({ dateRange, ...layerIncludeFlags(PATIENT_LAYERS, options) });
      const rows = await fetchAdHocPatientRows(oystehr, input);
      const json = JSON.stringify(validateOutputWithSchema(AdHocPatientsOutputSchema, { patients: rows }, ZAMBDA_NAME));
      return { json, rowCount: rows.length };
    }
    case 'billing': {
      const input = AdHocBillingInputSchema.parse({ dateRange, ...layerIncludeFlags(BILLING_LAYERS, options) });
      const rows = await fetchAdHocBillingRows(oystehr, input);
      const json = JSON.stringify(validateOutputWithSchema(AdHocBillingOutputSchema, { rows }, ZAMBDA_NAME));
      return { json, rowCount: rows.length };
    }
    default:
      throw new Error(`Unknown ad-hoc dataset "${datasetId}"`);
  }
}

async function stage<T>(
  name: string,
  taskId: string | undefined,
  startedAt: number,
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(
      `[adhoc] ${name} FAILED task=${taskId} ms=${Date.now() - startedAt} ` +
        `code=${(error as { code?: unknown })?.code ?? 'none'} ` +
        `message=${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export const index = wrapTaskHandler(ZAMBDA_NAME, async (input, oystehr) => {
  const { task, secrets } = input;
  const startedAt = Date.now();

  beginReportBudget();
  const params = await stage('read params', task.id, startedAt, async () => readParams(task));

  console.log(
    `[adhoc] start task=${task.id} dataset=${params.datasetId} ` +
      `range=${params.dateRange.start}..${params.dateRange.end} ` +
      `layers=${JSON.stringify(Object.keys(params.options ?? {}).filter((id) => params.options[id]))}`
  );

  const { json, rowCount } = await stage('build data', task.id, startedAt, () => buildOutputJson(oystehr, params));
  console.log(`[adhoc] data ready task=${task.id} ms=${Date.now() - startedAt} rows=${rowCount} bytes=${json.length}`);

  const z3Url = await stage('upload', task.id, startedAt, () => uploadAdHocReportJsonToZ3(oystehr, secrets, json));
  console.log(`[adhoc] uploaded task=${task.id} ms=${Date.now() - startedAt}`);

  await stage('record output on task', task.id, startedAt, () =>
    oystehr.fhir.patch({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        {
          op: 'add',
          path: '/output',
          value: [
            {
              type: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_REPORT_OUTPUT_URL_CODE }] },
              valueString: z3Url,
            },
          ],
        },
      ],
    })
  );

  console.log(`[adhoc] done task=${task.id} ms=${Date.now() - startedAt}`);
  return { taskStatus: 'completed' as const, statusReason: 'Ad-hoc report data generated' };
});
