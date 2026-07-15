import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Identifier, Organization, Practitioner } from 'fhir/r4b';
import {
  CODE_SYSTEM_CLAIM_SECONDARY_IDENTIFIER_TYPE,
  FHIR_IDENTIFIER_CODE_NPI,
  FHIR_IDENTIFIER_CODE_TAX_EMPLOYER,
  FHIR_IDENTIFIER_CODE_TAXONOMY,
  FHIR_IDENTIFIER_NPI,
  FHIR_IDENTIFIER_SYSTEM,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  buildAddress,
  createBillingClient,
  LICENSE_TAG,
  PROVIDER_ROLE_BILLING,
  PROVIDER_ROLE_RENDERING,
  PROVIDER_ROLE_TAG,
  STRIPE_ACCOUNT_IDENTIFIER_SYSTEM,
} from '../shared';
import { CreateBillingProviderParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'create-billing-provider';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: CreateBillingProviderParams): Promise<{ id: string }> {
  const created = await oystehr.fhir.create<Practitioner | Organization>(buildProvider(params));
  return { id: created.id! };
}

function buildProvider(params: CreateBillingProviderParams): Practitioner | Organization {
  const tag = params.roles.map((role) => ({
    system: PROVIDER_ROLE_TAG,
    code: role === 'rendering' ? PROVIDER_ROLE_RENDERING : PROVIDER_ROLE_BILLING,
  }));

  const identifier: Identifier[] = [];
  if (params.npi) {
    identifier.push({ system: FHIR_IDENTIFIER_NPI, value: params.npi });
    identifier.push({
      type: { coding: [{ system: FHIR_IDENTIFIER_SYSTEM, code: FHIR_IDENTIFIER_CODE_NPI }] },
      value: params.npi,
    });
  }
  if (params.taxId) {
    identifier.push({
      type: { coding: [{ system: FHIR_IDENTIFIER_SYSTEM, code: FHIR_IDENTIFIER_CODE_TAX_EMPLOYER }] },
      value: params.taxId,
    });
  }
  if (params.taxonomyCode) {
    identifier.push({
      type: { coding: [{ system: CODE_SYSTEM_CLAIM_SECONDARY_IDENTIFIER_TYPE, code: FHIR_IDENTIFIER_CODE_TAXONOMY }] },
      value: params.taxonomyCode,
    });
  }

  const address = params.address ? [buildAddress(params.address)] : undefined;

  if (params.kind === 'individual') {
    if (params.licenseType) tag.push({ system: LICENSE_TAG, code: params.licenseType });
    const practitioner: Practitioner = {
      resourceType: 'Practitioner',
      active: true,
      meta: { tag },
      name: [{ family: params.lastName, given: [params.firstName] }],
    };
    if (identifier.length) practitioner.identifier = identifier;
    if (address) practitioner.address = address;
    return practitioner;
  }

  if (params.stripeAccountId) {
    identifier.push({ system: STRIPE_ACCOUNT_IDENTIFIER_SYSTEM, value: params.stripeAccountId });
  }

  const organization: Organization = {
    resourceType: 'Organization',
    active: true,
    meta: { tag },
    name: params.name,
  };
  if (identifier.length) organization.identifier = identifier;
  if (address) organization.address = address;
  return organization;
}
