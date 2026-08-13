import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import {
  BillingClaimsExportResponse,
  BillingClaimsExportStatusResponse,
  EXPORT_CLAIMS_CSV_TASK_CODE,
  EXPORT_CLAIMS_FILTERS_CODE,
  EXPORT_CLAIMS_INCOMPLETE_CODE,
  EXPORT_CSV_OUTPUT_URL_CODE,
  EXPORT_TASK_SYSTEM,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createPresignedUrl } from '../../shared/z3Utils';
import { createBillingClient } from '../shared';
import { ExportBillingClaimsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'export-billing-claims';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect(oystehr, params);
  console.groupEnd();
  console.debug('performEffect success');

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function performEffect(
  oystehr: Oystehr,
  params: ExportBillingClaimsParams
): Promise<BillingClaimsExportResponse> {
  if ('taskId' in params) return getExportStatus(oystehr, params.taskId);
  const { secrets: _secrets, ...filters } = params;

  const task = await oystehr.fhir.create<Task>({
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    code: {
      coding: [
        {
          system: EXPORT_TASK_SYSTEM,
          code: EXPORT_CLAIMS_CSV_TASK_CODE,
        },
      ],
    },
    // The whole filter set travels as one JSON string the worker re-validates with the same schema,
    // so the export can never read back a different search than the caller asked for.
    input: [
      {
        type: {
          coding: [
            {
              system: EXPORT_TASK_SYSTEM,
              code: EXPORT_CLAIMS_FILTERS_CODE,
            },
          ],
        },
        valueString: JSON.stringify(filters),
      },
    ],
  });

  if (!task.id) throw new Error('Export Task was created without an id');

  return {
    taskId: task.id,
  };
}

async function getExportStatus(oystehr: Oystehr, taskId: string): Promise<BillingClaimsExportStatusResponse> {
  const task = await oystehr.fhir.get<Task>({
    resourceType: 'Task',
    id: taskId,
  });
  if (!isClaimsExportTask(task)) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Task/${taskId} is not a claims export`);

  const status = task.status as BillingClaimsExportStatusResponse['status'];

  if (status === 'failed') {
    return {
      status,
      error: task.statusReason?.text ?? task.statusReason?.coding?.[0]?.code ?? 'Export failed',
    };
  }

  if (status === 'completed') {
    const objectUrl = taskOutputValue(task, EXPORT_CSV_OUTPUT_URL_CODE);
    if (objectUrl) {
      return {
        status,
        downloadUrl: await createPresignedUrl(m2mToken, objectUrl, 'download'),
        incomplete: taskOutputValue(task, EXPORT_CLAIMS_INCOMPLETE_CODE) === 'true',
      };
    }
  }

  return {
    status,
  };
}

const taskOutputValue = (task: Task, code: string): string | undefined =>
  task.output?.find((output) => output.type?.coding?.some((coding) => coding.code === code))?.valueString;

const isClaimsExportTask = (task: Task): boolean =>
  task.code?.coding?.some(
    (coding) => coding.system === EXPORT_TASK_SYSTEM && coding.code === EXPORT_CLAIMS_CSV_TASK_CODE
  ) ?? false;
