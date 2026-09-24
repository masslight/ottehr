import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DownloadClaimAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { CLAIM_ATTACHMENT_PATH_PREFIX, ownedAttachmentLocation, presignAttachment } from '../attachments';
import { createBillingClient, fetchById } from '../shared';
import { DownloadClaimAttachmentParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'download-claim-attachment',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const params = validateRequestParameters(input);
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
  const location = ownedAttachmentLocation(documentReference, {
    reference: `Claim/${params.claimId}`,
    projectApi: params.secrets['PROJECT_API'],
    projectId: params.secrets['PROJECT_ID'],
    prefix: CLAIM_ATTACHMENT_PATH_PREFIX,
    ownerId: params.claimId,
  });
  return {
    downloadUrl: await presignAttachment(oystehr, location, 'download'),
  };
}
