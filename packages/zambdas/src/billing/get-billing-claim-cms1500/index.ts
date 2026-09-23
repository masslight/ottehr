import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Organization, Practitioner } from 'fhir/r4b';
import { Cms1500FormData } from 'utils/lib/types/data/billing/cms1500.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient, fetchClaimGraph, getClaimType, resolvePayersByRef } from '../shared';
import { buildCms1500FormData, referringCareTeamMember } from './helpers';
import { GetClaimCms1500Params, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-claim-cms1500';

// The claim as the boxes of a CMS-1500 (02/12) form; the billing app renders it to PDF.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(oystehr: Oystehr, params: GetClaimCms1500Params): Promise<Cms1500FormData> {
  const graph = await fetchClaimGraph(oystehr, params.claimId);
  if (getClaimType(graph.claim) !== 'professional') {
    throw INVALID_INPUT_ERROR('The CMS-1500 form is only for professional claims. Institutional claims use the UB-04.');
  }
  const [payers, referringProvider] = await Promise.all([
    resolvePayersByRef(oystehr, [
      graph.claim.insurer?.reference,
      ...graph.coverages.map((coverage) => coverage.payor?.[0]?.reference),
    ]),
    fetchReferringProvider(oystehr, graph.claim),
  ]);
  return buildCms1500FormData({ ...graph, payers, referringProvider });
}

// Item 17's provider isn't part of the claim graph, which only follows the rendering provider.
async function fetchReferringProvider(
  oystehr: Oystehr,
  claim: Claim
): Promise<Practitioner | Organization | undefined> {
  const [resourceType, id] = referringCareTeamMember(claim)?.provider?.reference?.split('/') ?? [];
  if (!id || (resourceType !== 'Practitioner' && resourceType !== 'Organization')) return undefined;
  return oystehr.fhir.get<Practitioner | Organization>({ resourceType, id });
}
