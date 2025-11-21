import { CodeableConcept, Coding, Provenance } from 'fhir/r4b';

export function createProvenanceForEncounter(
  encounterId: string,
  practitionerId: string,
  role: 'author' | 'verifier',
  recorded: string = new Date().toISOString()
): Provenance {
  const roleCoding: Coding = {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
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
