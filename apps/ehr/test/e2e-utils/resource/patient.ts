import { Patient, ContactPoint, Address, CodeableConcept, Coding, HumanName } from 'fhir/r4';

interface PatientParams {
  firstName: string;
  lastName: string;
  gender: Patient['gender'];
  birthDate: string;
  city?: string;
  line?: string;
  state?: string;
  postalCode?: string;
  email?: string;
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
  email,
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

  const telecom: ContactPoint | undefined = email
    ? {
        value: email,
        system: 'email',
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
        telecom: telecom ? [telecom] : undefined,
        relationship: [relationshipConcept],
      },
    ],
    birthDate,
    extension: [
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/form-user',
        valueString: relationship,
      },
    ],
  };
}
