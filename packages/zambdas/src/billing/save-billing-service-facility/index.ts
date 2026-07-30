import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location, ProvenanceAgent } from 'fhir/r4b';
import { FHIR_IDENTIFIER_NPI, INVALID_INPUT_ERROR, makeOptimisticLockIfMatchHeader } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { commitClaimResourceChange, resolveClaimActor } from '../provenance';
import { applyServiceFacilityInput } from '../service-facility.helpers';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAMS, fetchById, isWorkingCopy } from '../shared';
import { SaveServiceFacilityParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'save-billing-service-facility';

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
  console.debug('complexValidation success', existing);

  // A claim-scoped edit (the claim screen editing the claim's facility working copy) is recorded in
  // that claim's history, so it needs the acting user; master-screen edits carry no claim context
  // and keep working without a resolvable caller.
  const agent = params.claimId
    ? await resolveClaimActor('caller', oystehr, input.headers?.Authorization, secrets)
    : undefined;

  console.group('performEffect');
  const response = await performEffect(oystehr, params, existing, agent);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function complexValidation(oystehr: Oystehr, params: SaveServiceFacilityParams): Promise<Location | undefined> {
  const { facilityId, npi } = params;

  const existing = facilityId ? await fetchById<Location>(oystehr, 'Location', facilityId) : undefined;

  // Don't validate claim-level copies for NPI conflicts
  if (npi && (!existing || !isWorkingCopy(existing))) {
    const bundle = await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        {
          name: 'identifier',
          value: `${FHIR_IDENTIFIER_NPI}|${npi}`,
        },
        {
          name: 'status',
          value: 'active',
        },
        ...EXCLUDE_WORKING_COPIES_PARAMS,
      ],
    });
    const conflict = bundle.unbundle().some((location) => location.id !== facilityId);
    if (conflict) {
      throw INVALID_INPUT_ERROR(`An active service facility with NPI ${npi} already exists`);
    }
  }

  return existing;
}

export async function performEffect(
  oystehr: Oystehr,
  params: SaveServiceFacilityParams,
  existing: Location | undefined,
  agent?: ProvenanceAgent
): Promise<{ id: string | undefined }> {
  const location = applyServiceFacilityInput(params, existing);

  if (existing) {
    if (params.claimId && agent) {
      // Write the update and its claim-history Provenance in one transaction, keeping the same
      // optimistic lock the plain update uses.
      await commitClaimResourceChange(oystehr, {
        resource: location,
        before: existing,
        agent,
        claimReference: `Claim/${params.claimId}`,
        ifMatch: makeOptimisticLockIfMatchHeader(existing),
      });
      return { id: location.id };
    }
    const updated = await oystehr.fhir.update<Location>(location, {
      optimisticLockingVersionId: existing.meta?.versionId,
    });
    return { id: updated.id };
  }

  // A create is never claim-scoped: the facility only enters a claim via the subsequent attach,
  // which records the claim's facility change itself.
  const created = await oystehr.fhir.create<Location>(location);
  return { id: created.id };
}
