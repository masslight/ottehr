import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getPresignedURL, GetRadiologyOrderPdfZambdaOutput, Secrets } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { getOrCreateRadiologyOrderForm } from '../shared/order-form-resources';
import { validateInput, validateSecrets } from './validation';

let m2mToken: string;

const ZAMBDA_NAME = 'radiology-get-order-pdf';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const secrets = validateSecrets(unsafeInput.secrets);
  const { body } = validateInput(unsafeInput);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const output = await performEffect(body.serviceRequestId, secrets, m2mToken, oystehr);

  return { statusCode: 200, body: JSON.stringify(output) };
});

const performEffect = async (
  serviceRequestId: string,
  secrets: Secrets,
  token: string,
  oystehr: Oystehr
): Promise<GetRadiologyOrderPdfZambdaOutput> => {
  const { documentReference, mediaUrl, presignedURL } = await getOrCreateRadiologyOrderForm(
    serviceRequestId,
    secrets,
    token,
    oystehr
  );

  // A reused form has to be signed for this print; a freshly generated one already is.
  const urlToPrint = presignedURL ?? (await getPresignedURL(mediaUrl, token));
  if (!urlToPrint) {
    throw new Error('Failed to get presigned URL for radiology order form PDF');
  }

  return { presignedURL: urlToPrint, documentReferenceId: documentReference.id ?? '' };
};
