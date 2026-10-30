import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ProvenanceAgent } from 'fhir/r4b';
import { AddClaimAttachmentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { AddClaimAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { attachClaimDocument } from '../claim-attachments';
import { resolveClaimActor } from '../provenance';
import { BillingOystehr, createBillingClient, fetchById } from '../shared';

type AddClaimAttachmentParams = ValidatedZambdaInput<typeof AddClaimAttachmentInputSchema> & {
  agent: ProvenanceAgent;
};

let m2mToken: string;

export const index = wrapHandler('add-claim-attachment', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(AddClaimAttachmentInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const agent = await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets);

  const result = await performEffect(oystehr, {
    ...params,
    agent,
  });
  return { statusCode: 200, body: JSON.stringify(result) };
});

export async function performEffect(
  oystehr: BillingOystehr,
  params: AddClaimAttachmentParams
): Promise<AddClaimAttachmentResponse> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);
  return attachClaimDocument({
    oystehr,
    claim,
    name: params.name,
    fileName: params.fileName,
    reportTypeCode: params.reportTypeCode,
    contentType: params.mimeType,
    secrets: params.secrets,
    agent: params.agent,
  });
}
