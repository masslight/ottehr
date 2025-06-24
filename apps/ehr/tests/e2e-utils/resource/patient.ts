import { Address, CodeableConcept, Coding, ContactPoint, HumanName, Patient } from 'fhir/r4';

export interface PatientParams {
  firstName: string;
  lastName: string;
  gender: Patient['gender'];
  birthDate: string;
  city?: string;
  line?: string;
  state?: string;
  postalCode?: string;
  telecom?: ContactPoint[];
  relationship?: string;
}

export function createPatient({
  firstName,
  lastName,
  gender,
  birthDate,
  city,
  line,
  state,
  postalCode,
  telecom,
  relationship = 'Parent/Guardian',
}: PatientParams): Patient {
  const name: HumanName = {
    given: [firstName],
    family: lastName,
  };

  const address: Address | undefined =
    city || line || state || postalCode
      ? {
          ...(city && { city }),
          ...(line && { line: [line] }),
          ...(state && { state }),
          ...(postalCode && { postalCode }),
        }
      : undefined;

  const relationshipCoding: Coding = {
    code: relationship,
    system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship',
    display: relationship,
  };

  const relationshipConcept: CodeableConcept = {
    coding: [relationshipCoding],
  };

  return {
    resourceType: 'Patient',
    name: [name],
    active: true,
    gender,
    contact: [
      {
        ...(address && { address }),
        telecom: telecom,
        relationship: [relationshipConcept],
      },
    ],
    address: address ? [address] : undefined,
    telecom: telecom,
    birthDate,
    extension: [
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/form-user',
        valueString: relationship,
      },
    ],
  };
}
