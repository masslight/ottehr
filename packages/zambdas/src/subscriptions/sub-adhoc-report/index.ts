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

async function buildOutputJson(oystehr: Oystehr, params: ReportParams): Promise<string> {
  const { datasetId, dateRange, options } = params;
  switch (datasetId) {
    case 'encounters-comprehensive': {
      const input = AdHocEncountersInputSchema.parse({ dateRange, ...layerIncludeFlags(ENCOUNTER_LAYERS, options) });
      const rows = await fetchAdHocEncounterRows(oystehr, input);
      return JSON.stringify(validateOutputWithSchema(AdHocEncountersOutputSchema, { encounters: rows }, ZAMBDA_NAME));
    }
    case 'patients': {
      const input = AdHocPatientsInputSchema.parse({ dateRange, ...layerIncludeFlags(PATIENT_LAYERS, options) });
      const rows = await fetchAdHocPatientRows(oystehr, input);
      return JSON.stringify(validateOutputWithSchema(AdHocPatientsOutputSchema, { patients: rows }, ZAMBDA_NAME));
    }
    case 'billing': {
      const input = AdHocBillingInputSchema.parse({ dateRange, ...layerIncludeFlags(BILLING_LAYERS, options) });
      const rows = await fetchAdHocBillingRows(oystehr, input);
      return JSON.stringify(validateOutputWithSchema(AdHocBillingOutputSchema, { rows }, ZAMBDA_NAME));
    }
    default:
      throw new Error(`Unknown ad-hoc dataset "${datasetId}"`);
  }
}

export const index = wrapTaskHandler(ZAMBDA_NAME, async (input, oystehr) => {
  const { task, secrets } = input;

  beginReportBudget();
  const json = await buildOutputJson(oystehr, readParams(task));
  const z3Url = await uploadAdHocReportJsonToZ3(oystehr, secrets, json);

  await oystehr.fhir.patch({
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
  });

  return { taskStatus: 'completed' as const, statusReason: 'Ad-hoc report data generated' };
});
