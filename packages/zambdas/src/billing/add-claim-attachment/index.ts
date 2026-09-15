import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim } from 'fhir/r4b';
import { AddClaimAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { attachClaimDocument } from '../claim-attachments';
import { createBillingClient, fetchById } from '../shared';
import { AddClaimAttachmentParams, validateRequestParameters } from './validateRequestParameters';

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
  params: AddClaimAttachmentParams
): Promise<AddClaimAttachmentResponse> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);
  const { uploadUrl } = await attachClaimDocument({
    oystehr,
    claim,
    name: params.name,
    reportTypeCode: params.reportTypeCode,
    secrets: params.secrets,
  });
  return { uploadUrl };
}
