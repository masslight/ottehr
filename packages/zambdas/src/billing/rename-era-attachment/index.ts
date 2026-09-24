import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import { OkResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ERA_ATTACHMENT_PATH_PREFIX, ownedAttachmentLocation, renamedAttachmentContent } from '../attachments';
import { createBillingClient, fetchById } from '../shared';
import { RenameEraAttachmentParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'rename-era-attachment';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const result = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(result) };
});

// Changes the name shown for the attachment; the stored file keeps its name.
export async function performEffect(oystehr: Oystehr, params: RenameEraAttachmentParams): Promise<OkResponse> {
  const documentReference = await fetchById<DocumentReference>(
    oystehr,
    'DocumentReference',
    params.documentReferenceId
  );
  ownedAttachmentLocation(documentReference, eraOwner(params));
  await oystehr.fhir.patch<DocumentReference>({
    resourceType: 'DocumentReference',
    id: params.documentReferenceId,
    operations: [{ op: 'replace', path: '/content', value: renamedAttachmentContent(documentReference, params.name) }],
  });
  return { ok: true };
}

function eraOwner(params: { eraId: string; secrets: Secrets }): Parameters<typeof ownedAttachmentLocation>[1] {
  return {
    reference: `PaymentReconciliation/${params.eraId}`,
    projectApi: params.secrets['PROJECT_API'],
    projectId: params.secrets['PROJECT_ID'],
    prefix: ERA_ATTACHMENT_PATH_PREFIX,
    ownerId: params.eraId,
  };
}
