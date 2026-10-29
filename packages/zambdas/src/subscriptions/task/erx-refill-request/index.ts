import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { syncRefillRequestTask } from '../../../shared/erx-refill-requests';
import { createClinicalOystehrClient, validateJsonBody } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';

const ZAMBDA_NAME = 'erx-refill-request-subscription';

interface Input {
  renewalTask: Task;
  secrets: Secrets | null;
}

let m2mToken: string;

// The eRx service makes a renewal Task for each pharmacy's refill request, and updates it when the pharmacy asks again,
// withdraws it, or it is answered.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { renewalTask, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const tasks = await syncRefillRequestTask(oystehr, renewalTask);

  return {
    statusCode: 200,
    body: JSON.stringify({ taskIds: tasks.map((task) => task.id) }),
  };
});

function validateRequestParameters(input: ZambdaInput): Input {
  const body = validateJsonBody(input);

  if (body.resourceType !== 'Task' || !body.id) {
    throw INVALID_INPUT_ERROR('Request body must be a Task resource');
  }

  return {
    renewalTask: body as Task,
    secrets: input.secrets,
  };
}
