import Oystehr from '@oystehr/sdk';
import { Practitioner, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { getProviderNameWithProfession, PARTICIPATION_CODE_SYSTEM } from 'utils';
import { ProgressNoteSignatures, SignatureProvenanceInfo } from './types';

type SignatureRole = 'author' | 'verifier';

const getAgentForRole = (provenance: Provenance, role: SignatureRole): ProvenanceAgent | undefined =>
  provenance.agent?.find((agent) =>
    agent.role?.some((concept) =>
      concept.coding?.some((coding) => coding.system === PARTICIPATION_CODE_SYSTEM && coding.code === role)
    )
  );

/**
 * Resolve the signing (`author`) and supervisor-approving (`verifier`) Provenances for an encounter.
 * Author provenances are written by `pending-supervisor-approval` when a provider signs; verifier
 * provenances by `sign-appointment` when a supervisor approves. Returns an empty object when no
 * provenances exist (e.g. the non-supervisor sign flow writes none).
 */
export const getEncounterSignatures = async (
  oystehr: Oystehr,
  encounterId: string
): Promise<ProgressNoteSignatures> => {
  const resources = (
    await oystehr.fhir.search<Provenance | Practitioner>({
      resourceType: 'Provenance',
      params: [
        { name: 'target', value: `Encounter/${encounterId}` },
        { name: '_include', value: 'Provenance:agent' },
      ],
    })
  ).unbundle();

  const provenances = resources.filter((resource): resource is Provenance => resource.resourceType === 'Provenance');
  const practitionerById = new Map(
    resources
      .filter((resource): resource is Practitioner => resource.resourceType === 'Practitioner' && !!resource.id)
      .map((practitioner) => [practitioner.id!, practitioner])
  );

  const resolve = (role: SignatureRole): SignatureProvenanceInfo | undefined => {
    // Use the most recently recorded Provenance carrying this role.
    const provenance = provenances
      .filter((candidate) => getAgentForRole(candidate, role))
      .sort((a, b) => (b.recorded ?? '').localeCompare(a.recorded ?? ''))[0];
    if (!provenance) return undefined;

    const practitionerId = getAgentForRole(provenance, role)?.who?.reference?.split('/')[1];
    const practitioner = practitionerId ? practitionerById.get(practitionerId) : undefined;

    return {
      name: practitioner ? getProviderNameWithProfession(practitioner) : '',
      dateTimeISO: provenance.recorded,
    };
  };

  return {
    signedBy: resolve('author'),
    approvedBy: resolve('verifier'),
  };
};
