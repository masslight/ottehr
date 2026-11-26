import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ProvenanceAgent } from 'fhir/r4b';
import { AddClaimAttachmentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { AddClaimAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { settledValueOrThrow } from '../../shared/settled';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { attachClaimDocument } from '../claim-attachments';
import { resolveClaimActor } from '../provenance';
import { createBillingClient, fetchById } from '../shared';

type AddClaimAttachmentParams = ValidatedZambdaInput<typeof AddClaimAttachmentInputSchema> & {
  agent: ProvenanceAgent | Promise<ProvenanceAgent>;
};

let m2mToken: string;

export const index = wrapHandler('add-claim-attachment', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(AddClaimAttachmentInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const result = await performEffect(oystehr, {
    ...params,
    agent: resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets),
  });
  return { statusCode: 200, body: JSON.stringify(result) };
});

export async function performEffect(
  oystehr: Oystehr,
  params: AddClaimAttachmentParams
): Promise<AddClaimAttachmentResponse> {
  const [claimResult, agentResult] = await Promise.allSettled([
    fetchById<Claim>(oystehr, 'Claim', params.claimId),
    params.agent,
  ]);
  const agent = settledValueOrThrow(agentResult);
  const claim = settledValueOrThrow(claimResult);
  return attachClaimDocument({
    oystehr,
    claim,
    name: params.name,
    fileName: params.fileName,
    reportTypeCode: params.reportTypeCode,
    contentType: params.mimeType,
    secrets: params.secrets,
    agent,
  });
}
