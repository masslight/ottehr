import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { GetRadiologyOrderPdfZambdaOutput, Secrets } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { createRadiologyOrderFormPDF } from '../../../shared/pdf/radiology-order-form-pdf';
import { gatherRadiologyOrderFormInput } from '../shared/order-form-resources';
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
  const { input, refs } = await gatherRadiologyOrderFormInput(serviceRequestId, oystehr);

  const { documentReference, presignedURL } = await createRadiologyOrderFormPDF(input, refs, secrets, token);

  return { presignedURL, documentReferenceId: documentReference.id ?? '' };
};
