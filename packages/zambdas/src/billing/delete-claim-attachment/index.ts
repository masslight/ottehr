import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, DocumentReference } from 'fhir/r4b';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { CLAIM_ATTACHMENT_PATH_PREFIX, deleteAttachmentObject, ownedAttachmentLocation } from '../attachments';
import { BillingFhirResource, createBillingClient, fetchById } from '../shared';
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
  const location = ownedAttachmentLocation(documentReference, {
    reference: `Claim/${claim.id}`,
    projectApi: params.secrets['PROJECT_API'],
    projectId: params.secrets['PROJECT_ID'],
    prefix: CLAIM_ATTACHMENT_PATH_PREFIX,
    ownerId: claim.id,
  });
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

  await deleteAttachmentObject(oystehr, location);

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
