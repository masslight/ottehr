import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { FhirResource, Organization } from 'fhir/r4b';
import { InternalError } from 'utils/lib/helpers/oystehrApi';
import { CreatedResourceResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  buildCoverageOrganization,
  buildNioAffiliation,
  buildNioOrganization,
  isNonInsuranceOrganization,
  NioPayerReference,
  resolveWcPayerReference,
} from '../non-insurance-org.helpers';
import { createBillingClient } from '../shared';
import { CreateNonInsuranceOrgParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'create-billing-non-insurance-org';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('complexValidation');
  const payerRef = await resolveWcPayerReference(oystehr, params.covers);
  console.groupEnd();
  console.debug('complexValidation success');

  console.group('performEffect');
  const response = await performEffect(oystehr, params, payerRef);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

// The NIO org, one coverage org per checked category, and the affiliations linking them are
// written in one transaction so they all succeed or fail together.
export async function performEffect(
  oystehr: Oystehr,
  params: CreateNonInsuranceOrgParams,
  payerRef?: NioPayerReference
): Promise<CreatedResourceResponse> {
  const nioUrn = `urn:uuid:${randomUUID()}`;
  const requests: BatchInputRequest<FhirResource>[] = [
    { method: 'POST', url: '/Organization', resource: buildNioOrganization(params), fullUrl: nioUrn },
  ];

  for (const coverage of params.covers ?? []) {
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
        nioReference: nioUrn,
        coverageReference: coverageUrn,
        category: coverage.category,
      }),
    });
  }

  const tx = await oystehr.fhir.transaction<FhirResource>({ requests });
  const created = (tx.entry ?? [])
    .map((entry) => entry.resource)
    .find((resource): resource is Organization => {
      return resource?.resourceType === 'Organization' && isNonInsuranceOrganization(resource);
    });
  if (!created?.id) throw InternalError;
  return { id: created.id };
}
