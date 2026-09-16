import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource, Organization } from 'fhir/r4b';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { SavedResourceResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  buildInsuranceOrganization,
  findInsuranceOrgByBusinessId,
  isInsuranceOrganization,
} from '../insurance-org.helpers';
import { createBillingClient, fetchById } from '../shared';
import { UpdateInsuranceOrgParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'update-billing-insurance-org';

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
  const response = await performEffect(oystehr, params, existing);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function complexValidation(oystehr: Oystehr, params: UpdateInsuranceOrgParams): Promise<Organization> {
  const existing = await fetchById<Organization>(oystehr, 'Organization', params.insuranceOrgId);
  if (!isInsuranceOrganization(existing)) {
    throw INVALID_INPUT_ERROR(`Organization ${params.insuranceOrgId} is not an insurance organization`);
  }
  const duplicate = await findInsuranceOrgByBusinessId(oystehr, params.orgId, params.insuranceOrgId);
  if (duplicate) {
    throw INVALID_INPUT_ERROR(`Insurance organization id "${params.orgId}" is already in use`);
  }
  return existing;
}

export async function performEffect(
  oystehr: Oystehr,
  params: UpdateInsuranceOrgParams,
  existing: Organization
): Promise<SavedResourceResponse> {
  const requests: BatchInputRequest<FhirResource>[] = [
    {
      method: 'PUT',
      url: `Organization/${existing.id}`,
      resource: buildInsuranceOrganization(params, existing),
      ifMatch: makeOptimisticLockIfMatchHeader(existing),
    },
  ];
  await oystehr.fhir.transaction<FhirResource>({ requests });
  return { id: existing.id };
}
