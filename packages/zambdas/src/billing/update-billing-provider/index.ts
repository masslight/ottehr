import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization, Practitioner, ProvenanceAgent } from 'fhir/r4b';
import { setNpi } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { commitClaimResourceChange, resolveClaimActor } from '../provenance';
import {
  buildAddress,
  createBillingClient,
  fetchById,
  LICENSE_TAG,
  PROVIDER_ROLE_BILLING,
  PROVIDER_ROLE_RENDERING,
  PROVIDER_ROLE_TAG,
  setStripeAccountId,
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

  const agent = await complexValidation(oystehr, params, input.headers?.Authorization);

  const response = await performEffect(oystehr, params, agent);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// A claim-scoped edit (the claim screen editing a provider working copy) is recorded in that
// claim's history, so it needs the acting user; master-screen edits carry no claim context and
// keep working without a resolvable caller.
async function complexValidation(
  oystehr: Oystehr,
  params: UpdateBillingProviderParams,
  authorizationHeader: string | undefined
): Promise<ProvenanceAgent | undefined> {
  if (!params.claimId) return undefined;
  return resolveClaimActor('caller', oystehr, authorizationHeader, params.secrets);
}

export async function performEffect(
  oystehr: Oystehr,
  params: UpdateBillingProviderParams,
  agent?: ProvenanceAgent
): Promise<{ id: string }> {
  if (params.kind === 'individual') {
    const provider = await fetchById<Practitioner>(oystehr, 'Practitioner', params.providerId);
    const before = structuredClone(provider);
    provider.name = [{ family: params.lastName, given: [params.firstName] }];
    applyIdentifiersAndAddress(provider, params);
    applyTags(provider, params.roles, params.licenseType);
    return save(oystehr, params, provider, before, agent);
  }

  const provider = await fetchById<Organization>(oystehr, 'Organization', params.providerId);
  const before = structuredClone(provider);
  provider.name = params.name;
  applyIdentifiersAndAddress(provider, params);
  applyTags(provider, params.roles, undefined);
  return save(oystehr, params, provider, before, agent);
}

// Claim-scoped edits write the update and its claim-history Provenance in one transaction;
// master-screen edits stay a plain update.
async function save(
  oystehr: Oystehr,
  params: UpdateBillingProviderParams,
  provider: Practitioner | Organization,
  before: Practitioner | Organization,
  agent: ProvenanceAgent | undefined
): Promise<{ id: string }> {
  if (params.claimId && agent) {
    await commitClaimResourceChange(oystehr, {
      resource: provider,
      before,
      agent,
      claimReference: `Claim/${params.claimId}`,
    });
    return { id: params.providerId };
  }
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
    stripeAccountId?: string;
    address?: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string };
  }
): void {
  setNpi(resource, params.npi ?? '');
  setTaxId(resource, params.taxId ?? '');
  setTaxonomy(resource, params.taxonomyCode ?? '');
  setStripeAccountId(resource, params.stripeAccountId ?? '');

  if (params.address) resource.address = [buildAddress(params.address)];
  else delete resource.address;
}
