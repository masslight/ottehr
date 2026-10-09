import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DownloadEraAttachmentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { DownloadEraAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { eraAttachmentOwner, ownedAttachmentLocation, presignAttachment } from '../attachments';
import { createBillingClient, fetchById } from '../shared';

type DownloadEraAttachmentParams = ValidatedZambdaInput<typeof DownloadEraAttachmentInputSchema>;

let m2mToken: string;
const ZAMBDA_NAME = 'download-era-attachment';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(DownloadEraAttachmentInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const result = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(result) };
});

export async function performEffect(
  oystehr: Oystehr,
  params: DownloadEraAttachmentParams
): Promise<DownloadEraAttachmentResponse> {
  const documentReference = await fetchById<DocumentReference>(
    oystehr,
    'DocumentReference',
    params.documentReferenceId
  );
  const location = ownedAttachmentLocation(documentReference, eraAttachmentOwner(params.eraId, params.secrets));
  return { downloadUrl: await presignAttachment(oystehr, location, 'download') };
}
