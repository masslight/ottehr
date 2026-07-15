import { APIGatewayProxyResult } from 'aws-lambda';
import { Task as FhirTask } from 'fhir/r4b';
import {
  EXPORT_CSV_OUTPUT_URL_CODE,
  EXPORT_INVOICES_CSV_TASK_CODE,
  EXPORT_INVOICES_CSV_TASK_SYSTEM,
  EXPORT_INVOICES_ZAMBDA_KEY,
  ExportInvoicesCsvKickOffResponse,
  ExportInvoicesCsvStatusResponse,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { createPresignedUrl } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = EXPORT_INVOICES_ZAMBDA_KEY;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParams = validateRequestParameters(input);
  const { secrets } = validatedParams;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // Mode 1: Check status of an existing export task
  if ('taskId' in validatedParams && validatedParams.taskId) {
    const task = (await oystehr.fhir.get({
      resourceType: 'Task',
      id: validatedParams.taskId,
    })) as FhirTask;
    const response = await buildStatusResponse(task, m2mToken);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }

  // Mode 2: Kick off a new export by creating a Task
  const filterInputs: FhirTask['input'] = [];
  if ('status' in validatedParams && validatedParams.status) {
    filterInputs.push({
      type: { coding: [{ system: EXPORT_INVOICES_CSV_TASK_SYSTEM, code: 'filter-status' }] },
      valueString: validatedParams.status,
    });
  }
  if ('sortField' in validatedParams && validatedParams.sortField) {
    filterInputs.push({
      type: { coding: [{ system: EXPORT_INVOICES_CSV_TASK_SYSTEM, code: 'sort-field' }] },
      valueString: validatedParams.sortField,
    });
  }
  if ('sortDirection' in validatedParams && validatedParams.sortDirection) {
    filterInputs.push({
      type: { coding: [{ system: EXPORT_INVOICES_CSV_TASK_SYSTEM, code: 'sort-direction' }] },
      valueString: validatedParams.sortDirection,
    });
  }
  if ('hideZeroBalance' in validatedParams && validatedParams.hideZeroBalance !== undefined) {
    filterInputs.push({
      type: { coding: [{ system: EXPORT_INVOICES_CSV_TASK_SYSTEM, code: 'hide-zero-balance' }] },
      valueBoolean: validatedParams.hideZeroBalance,
    });
  }

  const task = await oystehr.fhir.create<FhirTask>({
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    code: {
      coding: [{ system: EXPORT_INVOICES_CSV_TASK_SYSTEM, code: EXPORT_INVOICES_CSV_TASK_CODE }],
    },
    input: filterInputs.length > 0 ? filterInputs : undefined,
  });

  const response: ExportInvoicesCsvKickOffResponse = { taskId: task.id! };
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function buildStatusResponse(task: FhirTask, token: string): Promise<ExportInvoicesCsvStatusResponse> {
  const status = task.status as ExportInvoicesCsvStatusResponse['status'];

  if (status === 'completed') {
    const outputUrl = task.output?.find((o) =>
      o.type?.coding?.some((c) => c.code === EXPORT_CSV_OUTPUT_URL_CODE)
    )?.valueString;

    if (outputUrl) {
      const downloadUrl = await createPresignedUrl(token, outputUrl, 'download');
      return { status, downloadUrl };
    }
  }

  if (status === 'failed') {
    const reason = task.statusReason?.coding?.[0]?.code;
    return { status, error: reason ?? 'Export failed' };
  }

  return { status };
}
