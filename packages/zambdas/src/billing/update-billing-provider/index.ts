import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization, Practitioner } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  buildAddress,
  createBillingClient,
  fetchById,
  LICENSE_TAG,
  PROVIDER_ROLE_BILLING,
  PROVIDER_ROLE_RENDERING,
  PROVIDER_ROLE_TAG,
  setNpi,
  setTaxId,
  setTaxonomy,
} from '../shared';
import { UpdateBillingProviderParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'update-billing-provider';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: UpdateBillingProviderParams): Promise<{ id: string }> {
  if (params.kind === 'individual') {
    const provider = await fetchById<Practitioner>(oystehr, 'Practitioner', params.providerId);
    provider.name = [{ family: params.lastName, given: [params.firstName] }];
    applyIdentifiersAndAddress(provider, params);
    applyTags(provider, params.roles, params.licenseType);
    const updated = await oystehr.fhir.update(provider);
    return { id: updated.id! };
  }

  const provider = await fetchById<Organization>(oystehr, 'Organization', params.providerId);
  provider.name = params.name;
  applyIdentifiersAndAddress(provider, params);
  applyTags(provider, params.roles, undefined);
  const updated = await oystehr.fhir.update(provider);
  return { id: updated.id! };
}

// Roles and license type are meta tags; replace those two systems, preserve everything else.
function applyTags(
  resource: Practitioner | Organization,
  roles: ('billing' | 'rendering')[],
  licenseType: string | undefined
): void {
  const tag = (resource.meta?.tag ?? []).filter((t) => t.system !== PROVIDER_ROLE_TAG && t.system !== LICENSE_TAG);
  tag.push(
    ...roles.map((role) => ({
      system: PROVIDER_ROLE_TAG,
      code: role === 'rendering' ? PROVIDER_ROLE_RENDERING : PROVIDER_ROLE_BILLING,
    }))
  );
  if (licenseType) tag.push({ system: LICENSE_TAG, code: licenseType });
  resource.meta = { ...resource.meta, tag };
}

function applyIdentifiersAndAddress(
  resource: Practitioner | Organization,
  params: {
    npi?: string;
    taxonomyCode?: string;
    taxId?: string;
    address?: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string };
  }
): void {
  setNpi(resource, params.npi ?? '');
  setTaxId(resource, params.taxId ?? '');
  setTaxonomy(resource, params.taxonomyCode ?? '');

  if (params.address) resource.address = [buildAddress(params.address)];
  else delete resource.address;
}
