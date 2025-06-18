import { RelatedPerson } from 'fhir/r4b';

interface RelatedPersonParams {
  id?: string;
  patientId: string;
  phoneNumber?: string;
  relationshipCode?: string;
  relationshipSystem?: string;
}

export function createRelatedPerson({
  patientId,
  phoneNumber = '+12144985545',
  // cSpell:disable-next relatedperson
  relationshipCode = 'user-relatedperson',
  relationshipSystem = 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship',
}: RelatedPersonParams): RelatedPerson {
  return {
    resourceType: 'RelatedPerson',
    patient: {
      reference: `Patient/${patientId}`,
    },
    telecom: [
      {
        system: 'phone',
        value: phoneNumber,
      },
      {
        system: 'sms',
        value: phoneNumber,
      },
    ],
    relationship: [
      {
        coding: [
          {
            system: relationshipSystem,
            code: relationshipCode,
          },
        ],
      },
    ],
  };
}
