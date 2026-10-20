import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, FhirResource, ProvenanceAgent } from 'fhir/r4b';
import { RenameClaimAttachmentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { renamedAttachmentContent } from '../attachments';
import { attachedClaimId } from '../claim-attachments';
import { claimEventProvenanceRequest, resolveClaimActor } from '../provenance';
import { createBillingClient, fetchById } from '../shared';

type RenameClaimAttachmentParams = ValidatedZambdaInput<typeof RenameClaimAttachmentInputSchema> & {
  agent: ProvenanceAgent;
};

let m2mToken: string;

export const index = wrapHandler(
  'rename-claim-attachment',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const params = validateWithSchema(RenameClaimAttachmentInputSchema, input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);
    const agent = await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets);

    await performEffect(oystehr, {
      ...params,
      agent,
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
);

export async function performEffect(oystehr: Oystehr, params: RenameClaimAttachmentParams): Promise<void> {
  const documentReference = await fetchById<DocumentReference>(
    oystehr,
    'DocumentReference',
    params.documentReferenceId
  );
  const renamed: DocumentReference = {
    ...documentReference,
    content: renamedAttachmentContent(documentReference, params.name),
  };
  const provenance = claimEventProvenanceRequest({
    targetReference: `DocumentReference/${documentReference.id}`,
    claimId: attachedClaimId(documentReference),
    before: documentReference,
    after: renamed,
    agent: params.agent,
    activity: 'update',
  });
  const requests: BatchInputRequest<FhirResource>[] = [
    {
      method: 'PATCH',
      url: `/DocumentReference/${documentReference.id}`,
      operations: [
        {
          op: 'replace',
          path: `/content`,
          value: renamed.content,
        },
      ],
    },
    ...(provenance ? [provenance] : []),
  ];

  await oystehr.fhir.transaction<FhirResource>({ requests });
}
