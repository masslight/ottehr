import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import {
  AdHocBillingClaimsInputSchema,
  AdHocBillingClaimsOutputSchema,
  BILLING_CLAIMS_DATASET_ID,
  BILLING_CLAIMS_LAYERS,
} from 'utils/lib/types/adhoc/datasets/billing-claims';
import { AdHocBillingRulesOutputSchema, BILLING_RULES_DATASET_ID } from 'utils/lib/types/adhoc/datasets/billing-rules';
import { layerIncludeFlags } from 'utils/lib/types/adhoc/datasets/dataset';
import {
  ADHOC_REPORT_OUTPUT_URL_CODE,
  ADHOC_REPORT_PARAMS_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
} from 'utils/lib/types/adhoc/generation/report-task';
import { fetchAdHocClaimRows } from '../../../billing/adhoc/claims';
import { fetchAdHocRuleRows } from '../../../billing/adhoc/rules';
import { createBillingClient, createEraReadClient } from '../../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { validateOutputWithSchema } from '../../../shared/validate-zod';
import { wrapTaskHandler } from '../helpers';

const ZAMBDA_NAME = 'sub-adhoc-billing-dataset';

let m2mToken: string;

async function eraReadClientFor(secrets: Secrets): Promise<Oystehr> {
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  return createEraReadClient(m2mToken, secrets);
}

interface ReportParams {
  datasetId: string;
  dateRange: { start: string; end: string };
  options: Record<string, boolean>;
}

function readParams(task: Task): ReportParams {
  const raw = task.input?.find((i) => i.type?.coding?.some((c) => c.code === ADHOC_REPORT_PARAMS_CODE))?.valueString;

  if (!raw) throw new Error('Ad-hoc billing dataset Task is missing its params input');

  return JSON.parse(raw) as ReportParams;
}

async function buildOutputJson(
  oystehr: Oystehr,
  eraReadClient: Oystehr,
  params: ReportParams
): Promise<{ json: string; rowCount: number }> {
  const { datasetId, dateRange, options } = params;

  switch (datasetId) {
    case BILLING_CLAIMS_DATASET_ID: {
      const input = AdHocBillingClaimsInputSchema.parse({
        dateRange,
        ...layerIncludeFlags(BILLING_CLAIMS_LAYERS, options),
      });

      const rows = await fetchAdHocClaimRows(oystehr, input, { eraReadClient });
      const json = JSON.stringify(validateOutputWithSchema(AdHocBillingClaimsOutputSchema, { rows }, ZAMBDA_NAME));

      return { json, rowCount: rows.length };
    }

    case BILLING_RULES_DATASET_ID: {
      const rows = await fetchAdHocRuleRows(oystehr);
      const json = JSON.stringify(validateOutputWithSchema(AdHocBillingRulesOutputSchema, { rows }, ZAMBDA_NAME));
      return { json, rowCount: rows.length };
    }

    default:
      throw new Error(`Unknown billing ad-hoc dataset "${datasetId}"`);
  }
}

async function uploadJson(oystehr: Oystehr, secrets: Secrets, taskId: string, json: string): Promise<string> {
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const projectApi = getSecret(SecretsKeys.PROJECT_API, secrets);
  const bucketName = `${projectId}-${BUCKET_NAMES.BILLING_CLAIM_EXPORTS}`;
  const objectPath = `adhoc-billing-dataset-${taskId}.json`;

  await oystehr.z3.uploadFile({
    bucketName,
    'objectPath+': objectPath,
    file: new Blob([json], { type: 'application/json' }),
  });

  return `${projectApi}/z3/${bucketName}/${objectPath}`;
}

async function stage<T>(name: string, taskId: string, startedAt: number, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(
      `[adhoc-billing] ${name} FAILED task=${taskId} ms=${Date.now() - startedAt} ` +
        `code=${(error as { code?: unknown })?.code ?? 'none'} ` +
        `message=${error instanceof Error ? error.message : String(error)}`
    );

    throw error;
  }
}

export const index = wrapTaskHandler(
  ZAMBDA_NAME,
  async (input, oystehr) => {
    const { task, secrets } = input;
    const taskId = task.id!;
    const startedAt = Date.now();
    const params = await stage('read params', taskId, startedAt, async () => readParams(task));

    console.log(
      `[adhoc-billing] start task=${taskId} dataset=${params.datasetId} ` +
        `range=${params.dateRange.start}..${params.dateRange.end} ` +
        `layers=${JSON.stringify(Object.keys(params.options ?? {}).filter((id) => params.options[id]))}`
    );

    const { json, rowCount } = await stage('build data', taskId, startedAt, async () =>
      buildOutputJson(oystehr, await eraReadClientFor(secrets), params)
    );

    console.log(
      `[adhoc-billing] data ready task=${taskId} ms=${Date.now() - startedAt} rows=${rowCount} bytes=${json.length}`
    );

    const z3Url = await stage('upload', taskId, startedAt, () => uploadJson(oystehr, secrets, taskId, json));

    await stage('record output on task', taskId, startedAt, () =>
      oystehr.fhir.patch({
        resourceType: 'Task',
        id: taskId,
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

    console.log(`[adhoc-billing] done task=${taskId} ms=${Date.now() - startedAt}`);

    return { taskStatus: 'completed' as const, statusReason: `Ad-hoc billing dataset built (${rowCount} rows)` };
  },
  { createClient: createBillingClient }
);
