import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DownloadClaimAttachmentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { DownloadClaimAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { claimAttachmentOwner, ownedAttachmentLocation, presignAttachment } from '../attachments';
import { createBillingClient, fetchById } from '../shared';

type DownloadClaimAttachmentParams = ValidatedZambdaInput<typeof DownloadClaimAttachmentInputSchema>;

let m2mToken: string;

export const index = wrapHandler(
  'download-claim-attachment',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const params = validateWithSchema(DownloadClaimAttachmentInputSchema, input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const result = await performEffect(oystehr, params);
    return { statusCode: 200, body: JSON.stringify(result) };
  }
);

export async function performEffect(
  oystehr: Oystehr,
  params: DownloadClaimAttachmentParams
): Promise<DownloadClaimAttachmentResponse> {
  const documentReference = await fetchById<DocumentReference>(
    oystehr,
    'DocumentReference',
    params.documentReferenceId
  );
  const location = ownedAttachmentLocation(documentReference, claimAttachmentOwner(params.claimId, params.secrets));
  return {
    downloadUrl: await presignAttachment(oystehr, location, 'download'),
  };
}
