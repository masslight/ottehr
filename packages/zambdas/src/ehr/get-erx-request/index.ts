import { APIGatewayProxyResult } from 'aws-lambda';
import { GetErxRequestInput, GetErxRequestInputSchema } from 'utils/lib/types/api/erx.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { getErxRequest } from '../../shared/erx-refill-requests';
import { createClinicalOystehrClient, validateJsonBody } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';

let m2mToken: string;
const ZAMBDA_NAME = 'get-erx-request';

// The request a refill request task is about, for the request dialog on the Tasks page.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { taskId, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  return {
    statusCode: 200,
    body: JSON.stringify(await getErxRequest(oystehr, taskId)),
  };
});

function validateRequestParameters(input: ZambdaInput): GetErxRequestInput & Pick<ZambdaInput, 'secrets'> {
  const { taskId } = GetErxRequestInputSchema.parse(validateJsonBody(input));
  return { taskId, secrets: input.secrets };
}
