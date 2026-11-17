import { APIGatewayProxyResult } from 'aws-lambda';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { GetDmeOrderPdfInputSchema, GetDmeOrderPdfResponse } from 'utils/lib/types/api/dme.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import { getOrCreateDmeOrderForm } from './helpers';

let m2mToken: string;

const ZAMBDA_NAME = 'get-dme-order-pdf';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { deviceRequestId, secrets } = validateWithSchema(GetDmeOrderPdfInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const { mediaUrl, presignedURL } = await getOrCreateDmeOrderForm(deviceRequestId, secrets, m2mToken, oystehr);

  // A reused form has to be signed for this print; a freshly generated one already is.
  const urlToPrint = presignedURL ?? (await getPresignedURL(mediaUrl, m2mToken));
  if (!urlToPrint) {
    throw new Error('Failed to get presigned URL for DME order form PDF');
  }

  const response: GetDmeOrderPdfResponse = { presignedURL: urlToPrint };
  return { statusCode: 200, body: JSON.stringify(response) };
});
