import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, PaymentReconciliation } from 'fhir/r4b';
import { AddEraAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  buildAttachmentDocumentReference,
  ERA_ATTACHMENT_CONTENT_TYPES,
  ERA_ATTACHMENT_PATH_PREFIX,
  newAttachmentLocation,
  presignAttachment,
  resolveAttachmentContentType,
} from '../attachments';
import { createBillingClient, createEraReadClient, fetchById } from '../shared';
import { AddEraAttachmentParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'add-era-attachment';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const eraReadClient = createEraReadClient(m2mToken, params.secrets);
  const result = await performEffect(oystehr, eraReadClient, params);
  return { statusCode: 200, body: JSON.stringify(result) };
});

// Records a file attached to an ERA (typically the scan of a paper remit) and returns where the
// browser uploads it. The record exists before the upload finishes; the client deletes it again when
// its upload fails.
export async function performEffect(
  oystehr: Oystehr,
  eraReadClient: Oystehr,
  params: AddEraAttachmentParams
): Promise<AddEraAttachmentResponse> {
  // clearing-house ERAs are untagged, so the ERA is read with the untagged client
  const era = await fetchById<PaymentReconciliation>(eraReadClient, 'PaymentReconciliation', params.eraId);
  const contentType = resolveAttachmentContentType(params.name, params.contentType, ERA_ATTACHMENT_CONTENT_TYPES);
  const location = newAttachmentLocation(params.secrets['PROJECT_ID'], ERA_ATTACHMENT_PATH_PREFIX, era.id, params.name);
  const documentReference = await oystehr.fhir.create<DocumentReference>(
    buildAttachmentDocumentReference({
      location,
      projectApi: params.secrets['PROJECT_API'],
      title: params.name,
      contentType,
      relatedReference: `PaymentReconciliation/${era.id}`,
    })
  );
  return {
    documentReferenceId: documentReference.id ?? '',
    uploadUrl: await presignAttachment(oystehr, location, 'upload'),
  };
}
