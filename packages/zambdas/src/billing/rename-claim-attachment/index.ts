import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, FhirResource, ProvenanceAgent } from 'fhir/r4b';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { RenameClaimAttachmentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { settledValueOrThrow } from '../../shared/settled';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { renamedAttachmentContent, RETIRED_ATTACHMENT_STATUS } from '../attachments';
import { attachedClaimId } from '../claim-attachments';
import { claimEventProvenanceRequest, resolveClaimActor } from '../provenance';
import { createBillingClient, fetchById } from '../shared';

type RenameClaimAttachmentParams = ValidatedZambdaInput<typeof RenameClaimAttachmentInputSchema> & {
  agent: ProvenanceAgent | Promise<ProvenanceAgent>;
};

let m2mToken: string;

export const index = wrapHandler(
  'rename-claim-attachment',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const params = validateWithSchema(RenameClaimAttachmentInputSchema, input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);
    await performEffect(oystehr, {
      ...params,
      agent: resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets),
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
);

export async function performEffect(oystehr: Oystehr, params: RenameClaimAttachmentParams): Promise<void> {
  const [documentReferenceResult, agentResult] = await Promise.allSettled([
    fetchById<DocumentReference>(oystehr, 'DocumentReference', params.documentReferenceId),
    params.agent,
  ]);
  const agent = settledValueOrThrow(agentResult);
  const documentReference = settledValueOrThrow(documentReferenceResult);
  // a deletion retires the document before removing it, and a rename in between would outlive it
  if (documentReference.status === RETIRED_ATTACHMENT_STATUS) {
    throw INVALID_INPUT_ERROR(`DocumentReference ${documentReference.id} was deleted`);
  }
  const renamed: DocumentReference = {
    ...documentReference,
    content: renamedAttachmentContent(documentReference, params.name),
  };
  const provenance = claimEventProvenanceRequest({
    targetReference: `DocumentReference/${documentReference.id}`,
    claimId: attachedClaimId(documentReference),
    before: documentReference,
    after: renamed,
    agent,
    activity: 'update',
  });
  const requests: BatchInputRequest<FhirResource>[] = [
    getPatchBinary({
      resourceType: 'DocumentReference',
      resourceId: documentReference.id!,
      // fails if another rename landed after the read, so history never records a name it skipped
      ifMatch: makeOptimisticLockIfMatchHeader(documentReference),
      patchOperations: [
        {
          op: 'replace',
          path: `/content`,
          value: renamed.content,
        },
      ],
    }),
    ...(provenance ? [provenance] : []),
  ];

  await oystehr.fhir.transaction<FhirResource>({ requests });
}
