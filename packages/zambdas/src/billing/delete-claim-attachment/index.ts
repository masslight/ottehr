import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, DocumentReference } from 'fhir/r4b';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  BillingFhirResource,
  createBillingClient,
  fetchById,
  getClaimAttachmentBucketAndPathFromZ3Url,
} from '../shared';
import { DeleteClaimAttachmentParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'delete-claim-attachment',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const params = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    await performEffect(oystehr, params);
    return { statusCode: 200, body: JSON.stringify({ deleted: true }) };
  }
);

export async function performEffect(oystehr: Oystehr, params: DeleteClaimAttachmentParams): Promise<void> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);
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
  const supportingInfo = claim.supportingInfo ?? [];
  const supportingInfoIndex = supportingInfo.findIndex(
    (supportingInfo) =>
      supportingInfo.valueReference?.reference?.replace('DocumentReference/', '') === documentReference.id
  );
  if (supportingInfoIndex < 0) {
    throw INVALID_INPUT_ERROR(`Missing "Claim.supportingInfo" reference to DocumentReference ${documentReference.id}`);
  }
  const newSupportingInfo = [
    ...supportingInfo.slice(0, supportingInfoIndex),
    ...supportingInfo.slice(supportingInfoIndex + 1),
  ].map((supportingInfo, index) => ({
    ...supportingInfo,
    sequence: index + 1,
  }));

  try {
    await oystehr.z3.deleteObject({ bucketName, 'objectPath+': path });
  } catch (err) {
    // Because upload occurs on the client side, it's possible the file never made it to Z3
    console.error(`Could not delete ${path} from z3`, err);
  }

  const requests: BatchInputRequest<BillingFhirResource>[] = [
    {
      method: 'PATCH',
      url: `/Claim/${claim.id}`,
      operations: [{ op: 'replace', path: `/supportingInfo`, value: newSupportingInfo }],
    },
    { method: 'DELETE', url: `/DocumentReference/${documentReference.id}` },
  ];

  await oystehr.fhir.transaction<BillingFhirResource>({ requests });
}
