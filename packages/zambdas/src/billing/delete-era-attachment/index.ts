import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DeleteEraAttachmentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { DeletedResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { deleteAttachmentObject, eraAttachmentOwner, ownedAttachmentLocation } from '../attachments';
import { createBillingClient, fetchById } from '../shared';

type DeleteEraAttachmentParams = ValidatedZambdaInput<typeof DeleteEraAttachmentInputSchema>;

let m2mToken: string;
const ZAMBDA_NAME = 'delete-era-attachment';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(DeleteEraAttachmentInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const result = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(result) };
});

export async function performEffect(oystehr: Oystehr, params: DeleteEraAttachmentParams): Promise<DeletedResponse> {
  const documentReference = await fetchById<DocumentReference>(
    oystehr,
    'DocumentReference',
    params.documentReferenceId
  );
  const location = ownedAttachmentLocation(documentReference, eraAttachmentOwner(params.eraId, params.secrets));
  await oystehr.fhir.delete({ resourceType: 'DocumentReference', id: params.documentReferenceId });
  await deleteAttachmentObject(oystehr, location);
  return { deleted: true };
}
