import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, PaymentReconciliation } from 'fhir/r4b';
import { AddEraAttachmentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { AddEraAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import {
  buildAttachmentDocumentReference,
  ERA_ATTACHMENT_CONTENT_TYPES,
  ERA_ATTACHMENT_PATH_PREFIX,
  newAttachmentLocation,
  presignAttachment,
  resolveAttachmentContentType,
} from '../attachments';
import { createBillingClient, fetchById } from '../shared';

type AddEraAttachmentParams = ValidatedZambdaInput<typeof AddEraAttachmentInputSchema>;

let m2mToken: string;
const ZAMBDA_NAME = 'add-era-attachment';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(AddEraAttachmentInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const result = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(result) };
});

// Records a file attached to an ERA (typically the scan of a paper remit) and returns where the
// browser uploads it. The record exists before the upload finishes; the client deletes it again when
// its upload fails. The upload URL comes first: once the record is written, the client must get its id
// back to clean it up.
export async function performEffect(
  oystehr: Oystehr,
  params: AddEraAttachmentParams
): Promise<AddEraAttachmentResponse> {
  const era = await fetchById<PaymentReconciliation>(oystehr, 'PaymentReconciliation', params.eraId);
  const contentType = resolveAttachmentContentType(params.fileName, params.mimeType, ERA_ATTACHMENT_CONTENT_TYPES);
  const location = newAttachmentLocation(
    params.secrets['PROJECT_ID'],
    ERA_ATTACHMENT_PATH_PREFIX,
    era.id,
    params.fileName
  );
  const uploadUrl = await presignAttachment(oystehr, location, 'upload');
  const documentReference = await oystehr.fhir.create<DocumentReference>(
    buildAttachmentDocumentReference({
      location,
      projectApi: params.secrets['PROJECT_API'],
      title: params.name,
      contentType,
      relatedReference: `PaymentReconciliation/${era.id}`,
    })
  );
  if (!documentReference.id) throw new Error('The remit attachment was created without an id');
  return { documentReferenceId: documentReference.id, uploadUrl };
}
