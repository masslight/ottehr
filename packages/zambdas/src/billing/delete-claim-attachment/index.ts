import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, DocumentReference, FhirResource, ProvenanceAgent } from 'fhir/r4b';
import {
  makeOptimisticLockIfMatchHeader,
  versionLockedPatches,
  withVersionConflictRetries,
} from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { DeleteClaimAttachmentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import {
  claimAttachmentOwner,
  deleteAttachmentObject,
  ownedAttachmentLocation,
  RETIRED_ATTACHMENT_STATUS,
} from '../attachments';
import { claimEventProvenanceRequest, resolveClaimActor } from '../provenance';
import { createBillingClient, fetchById } from '../shared';

type DeleteClaimAttachmentParams = ValidatedZambdaInput<typeof DeleteClaimAttachmentInputSchema> & {
  agent: ProvenanceAgent;
};

let m2mToken: string;

export const index = wrapHandler(
  'delete-claim-attachment',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const params = validateWithSchema(DeleteClaimAttachmentInputSchema, input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);
    const agent = await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets);

    await performEffect(oystehr, {
      ...params,
      agent,
    });
    return { statusCode: 200, body: JSON.stringify({ deleted: true }) };
  }
);

export async function performEffect(oystehr: Oystehr, params: DeleteClaimAttachmentParams): Promise<void> {
  const { documentReference, location } = await withVersionConflictRetries(async () => {
    const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);
    const documentReference = await fetchById<DocumentReference>(
      oystehr,
      'DocumentReference',
      params.documentReferenceId
    );
    const location = ownedAttachmentLocation(documentReference, claimAttachmentOwner(claim.id, params.secrets));
    // retired by an earlier deletion that failed before removing it, so only the removal is left
    if (documentReference.status !== RETIRED_ATTACHMENT_STATUS) {
      await retireAttachment({
        oystehr,
        claim,
        documentReference,
        agent: params.agent,
      });
    }
    return {
      documentReference,
      location,
    };
  });
  await oystehr.fhir.delete({
    resourceType: 'DocumentReference',
    id: documentReference.id!,
  });
  await deleteAttachmentObject(oystehr, location);
}

// Takes the document off the claim and records its deletion, locked to the claim and document as
// read. A transaction can't lock a DELETE to a version, so the document is retired here instead and
// removed once nothing points at it.
async function retireAttachment({
  oystehr,
  claim,
  documentReference,
  agent,
}: {
  oystehr: Oystehr;
  claim: Claim;
  documentReference: DocumentReference;
  agent: ProvenanceAgent;
}): Promise<void> {
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

  const provenance = claimEventProvenanceRequest({
    targetReference: `DocumentReference/${documentReference.id}`,
    claimId: claim.id,
    before: documentReference,
    agent,
    activity: 'delete',
  });

  const requests: BatchInputRequest<FhirResource>[] = [
    {
      method: 'PATCH',
      url: `/Claim/${claim.id}`,
      operations: [{ op: 'replace', path: `/supportingInfo`, value: newSupportingInfo }],
    },
    getPatchBinary({
      resourceType: 'DocumentReference',
      resourceId: documentReference.id!,
      ifMatch: makeOptimisticLockIfMatchHeader(documentReference),
      patchOperations: [
        {
          op: 'replace',
          path: '/status',
          value: RETIRED_ATTACHMENT_STATUS,
        },
      ],
    }),
    ...(provenance ? [provenance] : []),
  ];

  await oystehr.fhir.transaction<FhirResource>({
    requests: versionLockedPatches({
      requests,
      resource: claim,
    }),
  });
}
