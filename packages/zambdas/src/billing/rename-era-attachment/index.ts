import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, PaymentReconciliation } from 'fhir/r4b';
import { RenameEraAttachmentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { OkResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { eraAttachmentOwner, ownedAttachmentLocation, renamedAttachmentContent } from '../attachments';
import { eraEditGuard } from '../era-write';
import { createBillingClient, fetchById } from '../shared';

type RenameEraAttachmentParams = ValidatedZambdaInput<typeof RenameEraAttachmentInputSchema>;

let m2mToken: string;
const ZAMBDA_NAME = 'rename-era-attachment';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(RenameEraAttachmentInputSchema, input);
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
  ownedAttachmentLocation(documentReference, eraAttachmentOwner(params.eraId, params.secrets));
  const era = await fetchById<PaymentReconciliation>(oystehr, 'PaymentReconciliation', params.eraId);
  await oystehr.fhir.transaction({
    requests: [
      {
        method: 'PATCH',
        url: `/DocumentReference/${params.documentReferenceId}`,
        operations: [
          { op: 'replace', path: '/content', value: renamedAttachmentContent(documentReference, params.name) },
        ],
      },
      eraEditGuard(era),
    ],
  });
  return { ok: true };
}
