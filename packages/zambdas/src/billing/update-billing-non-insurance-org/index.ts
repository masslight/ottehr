import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { FhirResource, Organization } from 'fhir/r4b';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { SavedResourceResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  buildCoverageOrganization,
  buildNioAffiliation,
  buildNioOrganization,
  computeCoverageChanges,
  fetchNioCoveragePairs,
  isNonInsuranceOrganization,
  NioCoveragePair,
  NioPayerReference,
  resolveWcPayerReference,
} from '../non-insurance-org.helpers';
import { createBillingClient, fetchById } from '../shared';
import { UpdateNonInsuranceOrgParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'update-billing-non-insurance-org';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('complexValidation');
  const { existing, pairs, payerRef } = await complexValidation(oystehr, params);
  console.groupEnd();
  console.debug('complexValidation success');

  console.group('performEffect');
  const response = await performEffect(oystehr, params, existing, pairs, payerRef);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function complexValidation(
  oystehr: Oystehr,
  params: UpdateNonInsuranceOrgParams
): Promise<{ existing: Organization; pairs: NioCoveragePair[]; payerRef?: NioPayerReference }> {
  const existing = await fetchById<Organization>(oystehr, 'Organization', params.nioId);
  if (!isNonInsuranceOrganization(existing)) {
    throw INVALID_INPUT_ERROR(`Organization ${params.nioId} is not a non-insurance organization`);
  }
  const [pairs, payerRef] = await Promise.all([
    fetchNioCoveragePairs(oystehr, params.nioId),
    resolveWcPayerReference(oystehr, params.covers),
  ]);
  return { existing, pairs, payerRef };
}

// Full replace: the whole entity is rewritten and the covers set reconciled — newly checked
// categories create (or reactivate) their pair, unchecked ones deactivate theirs — in one
// transaction with an optimistic lock on every updated resource.
export async function performEffect(
  oystehr: Oystehr,
  params: UpdateNonInsuranceOrgParams,
  existing: Organization,
  pairs: NioCoveragePair[],
  payerRef?: NioPayerReference
): Promise<SavedResourceResponse> {
  const nioReference = `Organization/${existing.id}`;
  const requests: BatchInputRequest<FhirResource>[] = [
    {
      method: 'PUT',
      url: nioReference,
      resource: buildNioOrganization(params, existing),
      ifMatch: makeOptimisticLockIfMatchHeader(existing),
    },
  ];

  const changes = computeCoverageChanges(params.covers ?? [], pairs);

  for (const coverage of changes.creates) {
    const coverageUrn = `urn:uuid:${randomUUID()}`;
    requests.push({
      method: 'POST',
      url: '/Organization',
      resource: buildCoverageOrganization({
        nioName: params.name,
        coverage,
        payerRef: coverage.category === 'workers-comp' ? payerRef : undefined,
      }),
      fullUrl: coverageUrn,
    });
    requests.push({
      method: 'POST',
      url: '/OrganizationAffiliation',
      resource: buildNioAffiliation({
        nioReference,
        coverageReference: coverageUrn,
        category: coverage.category,
      }),
    });
  }

  for (const { coverage, pair } of changes.updates) {
    // computeCoverageChanges only reuses pairs that still have their coverage org.
    const coverageOrg = pair.coverageOrg!;
    requests.push({
      method: 'PUT',
      url: `Organization/${coverageOrg.id}`,
      resource: buildCoverageOrganization({
        nioName: params.name,
        coverage,
        payerRef: coverage.category === 'workers-comp' ? payerRef : undefined,
        existing: coverageOrg,
      }),
      ifMatch: makeOptimisticLockIfMatchHeader(coverageOrg),
    });
    if (pair.affiliation.active === false) {
      requests.push({
        method: 'PUT',
        url: `OrganizationAffiliation/${pair.affiliation.id}`,
        resource: buildNioAffiliation({
          nioReference,
          coverageReference: `Organization/${coverageOrg.id}`,
          category: coverage.category,
          existing: pair.affiliation,
        }),
        ifMatch: makeOptimisticLockIfMatchHeader(pair.affiliation),
      });
    }
  }

  for (const pair of changes.deactivates) {
    requests.push({
      method: 'PUT',
      url: `OrganizationAffiliation/${pair.affiliation.id}`,
      resource: { ...pair.affiliation, active: false },
      ifMatch: makeOptimisticLockIfMatchHeader(pair.affiliation),
    });
    if (pair.coverageOrg && pair.coverageOrg.active !== false) {
      requests.push({
        method: 'PUT',
        url: `Organization/${pair.coverageOrg.id}`,
        resource: { ...pair.coverageOrg, active: false },
        ifMatch: makeOptimisticLockIfMatchHeader(pair.coverageOrg),
      });
    }
  }

  await oystehr.fhir.transaction<FhirResource>({ requests });
  return { id: existing.id };
}
