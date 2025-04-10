import { Coverage, RelatedPerson } from 'fhir/r4b';
import { COVERAGE_MEMBER_IDENTIFIER_BASE } from 'utils';

export const expectedPrimaryPolicyHolderFromQR1: RelatedPerson = {
  resourceType: 'RelatedPerson',
  id: 'coverageSubscriber',
  name: [
    {
      given: ['Barnabas', 'Thaddeus'],
      family: 'Picklesworth',
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
      city: 'Deliciousville',
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
      family: 'Picklesworth',
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
      value: '+15559876543',
    },
  ],
};

export const expectedCoverageResources: { primary: Coverage; secondary: Coverage } = {
  primary: {
    resourceType: 'Coverage',
    identifier: [
      {
        ...COVERAGE_MEMBER_IDENTIFIER_BASE, // this holds the 'type'
        value: 'FAfonejwgndkoetwwe6',
        assigner: {
          reference: '{{ORGANIZATION_REF}}',
          display: 'Aetna',
        },
      },
    ],
    contained: [expectedPrimaryPolicyHolderFromQR1],
    status: 'active',
    beneficiary: { reference: '{{PATIENT_REF}}', type: 'Patient' },
    payor: [{ reference: '{{ORGANIZATION_REF}}' }],
    subscriberId: 'FAfonejwgndkoetwwe6',
    subscriber: {
      reference: `#coverageSubscriber`,
    },
    relationship: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
          code: 'child',
          display: 'Child',
        },
      ],
    },
    class: [
      {
        name: 'Aetna',
        type: {
          coding: [
            {
              code: 'plan',
              system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
            },
          ],
        },
        value: '{{INSURANCEPLAN_REF}}',
      },
    ],
    type: {
      coding: [
        {
          code: 'HIP',
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        },
      ],
    },
  },
  secondary: {
    resourceType: 'Coverage',
    identifier: [
      {
        ...COVERAGE_MEMBER_IDENTIFIER_BASE, // this holds the 'type'
        value: 'fdfdfdfdfdfh7897',
        assigner: {
          reference: '{{ORGANIZATION_REF}}',
          display: 'Aetna',
        },
      },
    ],
    contained: [expectedSecondaryPolicyHolderFromQR1],
    status: 'active',
    beneficiary: { reference: '{{PATIENT_REF}}', type: 'Patient' },
    payor: [{ reference: '{{ORGANIZATION_REF}}' }],
    subscriberId: 'fdfdfdfdfdfh7897',
    subscriber: { reference: '#coverageSubscriber' },
    relationship: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
          code: 'child',
          display: 'Child',
        },
      ],
    },
    class: [
      {
        name: 'Aetna',
        type: {
          coding: [
            {
              code: 'plan',
              system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
            },
          ],
        },
        value: '{{INSURANCEPLAN_REF}}',
      },
    ],
    type: {
      coding: [
        {
          code: 'HIP',
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        },
      ],
    },
  },
};
