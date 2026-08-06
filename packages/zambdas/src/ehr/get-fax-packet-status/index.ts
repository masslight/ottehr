import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import {
  FAX_PACKET_RESULTS_TASK_OUTPUT,
  FaxJobStatus,
  FaxRecipientResult,
  GetFaxPacketStatusOutput,
} from 'utils/lib/types/api/fax.types';
import { ZambdaInput } from '../../shared/types/common';
import { checkOrCreateM2MClientToken, getUser } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-fax-packet-status';

let m2mToken: string;

/** Terminal FHIR Task statuses map to the two job outcomes; everything else is still pending. */
const toJobStatus = (taskStatus: Task['status']): FaxJobStatus => {
  if (taskStatus === 'completed') return 'completed';
  if (taskStatus === 'failed' || taskStatus === 'cancelled' || taskStatus === 'rejected') return 'failed';
  return 'pending';
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { taskId, secrets } = validateRequestParameters(input);

  await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });

  const resultsJson = task.output?.find(
    (entry) =>
      entry.type?.coding?.some(
        (coding) =>
          coding.system === FAX_PACKET_RESULTS_TASK_OUTPUT.system && coding.code === FAX_PACKET_RESULTS_TASK_OUTPUT.code
      )
  )?.valueString;

  const recipients: FaxRecipientResult[] = resultsJson ? (JSON.parse(resultsJson) as FaxRecipientResult[]) : [];

  const output: GetFaxPacketStatusOutput = { jobStatus: toJobStatus(task.status), recipients };

  return { statusCode: 200, body: JSON.stringify(output) };
});
