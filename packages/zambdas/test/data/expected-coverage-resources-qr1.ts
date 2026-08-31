import { RelatedPerson } from 'fhir/r4b';

export const expectedPrimaryPolicyHolderFromQR1: RelatedPerson = {
  resourceType: 'RelatedPerson',
  id: 'coverageSubscriber',
  name: [
    {
      given: ['Barnabas', 'Thaddeus'],
      family: 'PicklesWorth',
    },
  ],
  birthDate: '1982-02-23',
  gender: 'male',
  patient: { reference: '{{PATIENT_REF}}' },
  relationship: [
    {
      coding: [
        {
          system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
          code: 'child',
          display: 'Child',
        },
      ],
    },
  ],
  address: [
    {
      line: ['317 Mustard Street', 'Unit 2'],
      city: 'DeliciousVilla',
      state: 'DE',
      postalCode: '20001',
    },
  ],
};

export const expectedSecondaryPolicyHolderFromQR1: RelatedPerson = {
  resourceType: 'RelatedPerson',
  id: 'coverageSubscriber',
  name: [
    {
      given: ['Jennifer', 'Celeste'],
      family: 'PicklesWorth',
    },
  ],
  birthDate: '1983-02-23',
  gender: 'female',
  patient: { reference: '{{PATIENT_REF}}' },
  relationship: [
    {
      coding: [
        {
          system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
          code: 'child',
          display: 'Child',
        },
      ],
    },
  ],
  address: [
    {
      line: ['317 R St NW Unit 2', 'conditional-filter-test-1234'],
      city: 'Washington',
      state: 'DC',
      postalCode: '20001',
    },
  ],
};

export const expectedAccountGuarantorFromQR1: RelatedPerson = {
  resourceType: 'RelatedPerson',
  id: 'accountGuarantorId',
  name: [{ given: ['Jane'], family: 'Doe' }],
  birthDate: '1983-02-23',
  gender: 'female',
  patient: { reference: '{{PATIENT_REF}}' }, // newPatient1
  address: [
    {
      city: 'fakePlace',
      line: ['123 test lane'],
      postalCode: '11111',
      state: 'NY',
    },
  ],
  relationship: [
    {
      coding: [
        {
          system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
          code: 'parent',
          display: 'Parent',
        },
      ],
    },
  ],
  telecom: [
    {
      system: 'phone',
      value: '+19895556543',
    },
    {
      system: 'email',
      value: 'rowdyroddypiper@hotmail.com',
    },
  ],
};
