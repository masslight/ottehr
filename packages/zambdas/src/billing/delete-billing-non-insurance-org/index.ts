import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource, Organization } from 'fhir/r4b';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { DeletedResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { fetchNioCoveragePairs, isNonInsuranceOrganization, NioCoveragePair } from '../non-insurance-org.helpers';
import { createBillingClient, fetchById } from '../shared';
import { DeleteNonInsuranceOrgParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'delete-billing-non-insurance-org';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('complexValidation');
  const { existing, pairs } = await complexValidation(oystehr, params);
  console.groupEnd();
  console.debug('complexValidation success');

  console.group('performEffect');
  const response = await performEffect(oystehr, existing, pairs);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function complexValidation(
  oystehr: Oystehr,
  params: DeleteNonInsuranceOrgParams
): Promise<{ existing: Organization; pairs: NioCoveragePair[] }> {
  const existing = await fetchById<Organization>(oystehr, 'Organization', params.nioId);
  if (!isNonInsuranceOrganization(existing)) {
    throw INVALID_INPUT_ERROR(`Organization ${params.nioId} is not a non-insurance organization`);
  }
  const pairs = await fetchNioCoveragePairs(oystehr, params.nioId);
  return { existing, pairs };
}

// Soft delete: active=false on the NIO org and every still-active affiliation + coverage org, in
// one transaction. Stored references to the NIO stay resolvable.
export async function performEffect(
  oystehr: Oystehr,
  existing: Organization,
  pairs: NioCoveragePair[]
): Promise<DeletedResponse> {
  const requests: BatchInputRequest<FhirResource>[] = [
    {
      method: 'PUT',
      url: `Organization/${existing.id}`,
      resource: { ...existing, active: false },
      ifMatch: makeOptimisticLockIfMatchHeader(existing),
    },
  ];
  for (const pair of pairs) {
    if (pair.affiliation.active !== false) {
      requests.push({
        method: 'PUT',
        url: `OrganizationAffiliation/${pair.affiliation.id}`,
        resource: { ...pair.affiliation, active: false },
        ifMatch: makeOptimisticLockIfMatchHeader(pair.affiliation),
      });
    }
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
  return { deleted: true };
}
