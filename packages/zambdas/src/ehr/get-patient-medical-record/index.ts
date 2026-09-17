import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { GetPatientMedicalRecordOutput } from 'utils/lib/types/data/get-patient-medical-record.types';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import {
  buildExportStatusResponse,
  cancelAbandonedExportTask,
  createExportTask,
  findActiveExportTask,
  toExportStatus,
} from '../../shared/medical-record-export/task';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createPresignedUrl } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-patient-medical-record';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  const { secrets } = params;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  const presign = (url: string): Promise<string> => createPresignedUrl(m2mToken, url, 'download');

  if ('taskId' in params) {
    const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: params.taskId });

    if (removePrefix('Patient/', task.for?.reference ?? '') !== params.patientId) {
      throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(
        `Task/${params.taskId} is not a medical record export for Patient/${params.patientId}`
      );
    }

    const response = await buildExportStatusResponse(task, presign);
    return { statusCode: 200, body: JSON.stringify(response) };
  }

  const { active, abandoned } = await findActiveExportTask(oystehr, params.patientId);
  if (active) {
    console.log(`Re-attaching to in-flight export Task/${active.id} for Patient/${params.patientId}`);
    const response = await buildExportStatusResponse(active, presign);
    return { statusCode: 200, body: JSON.stringify(response) };
  }

  for (const task of abandoned) {
    console.log(`Cancelling abandoned export Task/${task.id} (status ${task.status}) for Patient/${params.patientId}`);
    await cancelAbandonedExportTask(oystehr, task);
  }

  const task = await createExportTask(oystehr, params.patientId);
  console.log(`Queued export Task/${task.id} for Patient/${params.patientId}`);

  const response: GetPatientMedicalRecordOutput = {
    taskId: task.id!,
    status: toExportStatus(task.status),
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});
