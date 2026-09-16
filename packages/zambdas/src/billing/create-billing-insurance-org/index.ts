import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { InternalError } from 'utils/lib/helpers/oystehrApi';
import { CreatedResourceResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { buildInsuranceOrganization, findInsuranceOrgByBusinessId } from '../insurance-org.helpers';
import { createBillingClient } from '../shared';
import { CreateInsuranceOrgParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'create-billing-insurance-org';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('complexValidation');
  await complexValidation(oystehr, params);
  console.groupEnd();
  console.debug('complexValidation success');

  console.group('performEffect');
  const response = await performEffect(oystehr, params);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function complexValidation(oystehr: Oystehr, params: CreateInsuranceOrgParams): Promise<void> {
  const duplicate = await findInsuranceOrgByBusinessId(oystehr, params.orgId);
  if (duplicate) {
    throw INVALID_INPUT_ERROR(`Insurance organization id "${params.orgId}" is already in use`);
  }
}

export async function performEffect(
  oystehr: Oystehr,
  params: CreateInsuranceOrgParams
): Promise<CreatedResourceResponse> {
  const created = await oystehr.fhir.create(buildInsuranceOrganization(params));
  if (!created.id) throw InternalError;
  return { id: created.id };
}
