import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource, Organization } from 'fhir/r4b';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { DeletedResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { isInsuranceOrganization } from '../insurance-org.helpers';
import { createBillingClient, fetchById } from '../shared';
import { DeleteInsuranceOrgParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'delete-billing-insurance-org';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('complexValidation');
  const existing = await complexValidation(oystehr, params);
  console.groupEnd();
  console.debug('complexValidation success');

  console.group('performEffect');
  const response = await performEffect(oystehr, existing);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function complexValidation(oystehr: Oystehr, params: DeleteInsuranceOrgParams): Promise<Organization> {
  const existing = await fetchById<Organization>(oystehr, 'Organization', params.insuranceOrgId);
  if (!isInsuranceOrganization(existing)) {
    throw INVALID_INPUT_ERROR(`Organization ${params.insuranceOrgId} is not an insurance organization`);
  }
  return existing;
}

// Soft delete: active=false, so stored references stay resolvable.
export async function performEffect(oystehr: Oystehr, existing: Organization): Promise<DeletedResponse> {
  const requests: BatchInputRequest<FhirResource>[] = [
    {
      method: 'PUT',
      url: `Organization/${existing.id}`,
      resource: { ...existing, active: false },
      ifMatch: makeOptimisticLockIfMatchHeader(existing),
    },
  ];
  await oystehr.fhir.transaction<FhirResource>({ requests });
  return { deleted: true };
}
