import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DownloadClaimAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient, fetchById, getClaimAttachmentBucketAndPathFromZ3Url } from '../shared';
import { DownloadClaimAttachmentParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('add-claim-attachment', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const result = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(result) };
});

export async function performEffect(
  oystehr: Oystehr,
  params: DownloadClaimAttachmentParams
): Promise<DownloadClaimAttachmentResponse> {
  const documentReference = await fetchById<DocumentReference>(
    oystehr,
    'DocumentReference',
    params.documentReferenceId
  );
  const z3Url = documentReference.content[0]?.attachment.url;
  if (!z3Url) {
    throw INVALID_INPUT_ERROR(`Missing z3 URL in DocumentReference ${documentReference.id}`);
  }
  const [bucketName, path] = getClaimAttachmentBucketAndPathFromZ3Url(params.secrets['PROJECT_API'], z3Url);
  if (!bucketName || !path) {
    throw INVALID_INPUT_ERROR(`Invalid Z3 URL in DocumentReference ${documentReference.id}`);
  }

  const presignedUrlResult = await oystehr.z3.getPresignedUrl({ bucketName, 'objectPath+': path, action: 'download' });
  return {
    downloadUrl: presignedUrlResult.signedUrl,
  };
}
