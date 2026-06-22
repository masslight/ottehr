import { CodeableConcept, Coding, Provenance } from 'fhir/r4b';
import { PARTICIPATION_CODE_SYSTEM } from 'utils';

export function createProvenanceForEncounter(
  encounterId: string,
  practitionerId: string,
  role: 'author' | 'verifier',
  recorded: string = new Date().toISOString()
): Provenance {
  const roleCoding: Coding = {
    system: PARTICIPATION_CODE_SYSTEM,
    code: role,
    display: role === 'author' ? 'Author' : 'Verifier',
  };

  const roleConcept: CodeableConcept = {
    coding: [roleCoding],
  };

  return {
    resourceType: 'Provenance',
    target: [
      {
        reference: `Encounter/${encounterId}`,
      },
    ],
    recorded,
    agent: [
      {
        role: [roleConcept],
        who: {
          reference: `Practitioner/${practitionerId}`,
        },
      },
    ],
  };
}
