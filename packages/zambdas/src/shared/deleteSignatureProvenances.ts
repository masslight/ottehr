import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Provenance } from 'fhir/r4b';
import { PARTICIPATION_CODE_SYSTEM } from 'utils';

// The signer (`author`) and supervisor-approver (`verifier`) Provenance roles that back the
// visit-note signature block. Written by pending-supervisor-approval / sign-appointment and read
// by get-encounter-signatures.
const SIGNATURE_ROLE_CODES = new Set(['author', 'verifier']);

const isSignatureProvenance = (provenance: Provenance): boolean =>
  !!provenance.agent?.some(
    (agent) =>
      agent.role?.some(
        (concept) =>
          concept.coding?.some(
            (coding) => coding.system === PARTICIPATION_CODE_SYSTEM && SIGNATURE_ROLE_CODES.has(coding.code ?? '')
          )
      )
  );

/**
 * Build DELETE requests for the signer (`author`) and supervisor-approver (`verifier`) Provenances
 * targeting the given encounters.
 *
 * Unlocking a chart voids its recorded signature, so these Provenances must be removed. Otherwise a
 * re-sign that writes no new Provenance (the non-supervisor sign flow) would leave
 * get-encounter-signatures resolving the stale Provenance, and the regenerated visit-note PDF would
 * keep showing the old signing/approval time. Returns an empty array when there is nothing to delete.
 */
export const getSignatureProvenanceDeleteRequests = async (
  oystehr: Oystehr,
  encounterIds: string[]
): Promise<BatchInputDeleteRequest[]> => {
  const uniqueEncounterIds = [...new Set(encounterIds.filter(Boolean))];
  if (uniqueEncounterIds.length === 0) {
    return [];
  }

  const provenanceBundles = await Promise.all(
    uniqueEncounterIds.map((encounterId) =>
      oystehr.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Encounter/${encounterId}` }],
      })
    )
  );

  return provenanceBundles
    .flatMap((bundle) => bundle.unbundle())
    .filter((provenance) => provenance.id && isSignatureProvenance(provenance))
    .map((provenance) => ({ method: 'DELETE', url: `/Provenance/${provenance.id}` }));
};
