// Mock data shared by the stories in this folder (not a story itself).
import { Patient, Practitioner } from 'fhir/r4b';
import { PHRASES_EXTENSION_URL } from 'utils/lib/types/constants';
import type { FetchMock } from '../../harness/story';

export const mockPractitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'prac-1',
  active: true,
  name: [{ given: ['Dana'], family: 'Whitfield' }],
  extension: [
    {
      url: PHRASES_EXTENSION_URL,
      valueString: JSON.stringify([
        { key: 'normal-exam', value: 'Well appearing, in no acute distress. Lungs clear to auscultation bilaterally.' },
        { key: 'return-precautions', value: 'Return to clinic or go to the ER if symptoms worsen or fail to improve.' },
        { key: 'strep-neg', value: 'Rapid strep negative. Supportive care discussed with caregiver.' },
      ]),
    },
  ],
};

/** Signed-in user + practitioner profile, as loaded by useEvolveUser. */
export const userMocks: FetchMock[] = [
  {
    url: '/user/me',
    response: {
      id: 'user-1',
      email: 'dana.whitfield@example.com',
      name: 'Dana Whitfield',
      profile: 'Practitioner/prac-1',
      roles: [{ id: 'role-1', name: 'Administrator' }],
    },
  },
  { url: /\/fhir\/Practitioner\/prac-1/, response: mockPractitioner },
  { url: 'get-public-location-support-phones', response: { status: 200, output: { locations: [] } } },
];

export const patientA: Patient = {
  resourceType: 'Patient',
  id: '8a1f3c52-6d0e-4b7a-9c11-2f5e7d8a9b01',
  active: true,
  name: [{ given: ['Olivia'], family: 'Bennett' }],
  birthDate: '2016-04-12',
  gender: 'female',
  address: [{ line: ['412 Maple Ave'], city: 'Brooklyn', state: 'NY', postalCode: '11215' }],
  telecom: [
    { system: 'phone', value: '+12125550142' },
    { system: 'email', value: 'olivia.parent@example.com' },
  ],
  contact: [{ telecom: [{ system: 'phone', value: '+12125550187' }] }],
  extension: [{ url: 'https://fhir.zapehr.com/r4/StructureDefinitions/form-user', valueString: 'Parent/Guardian' }],
};

export const patientB: Patient = {
  resourceType: 'Patient',
  id: 'c47d9e10-3b2a-4f68-8e55-0a6b1c2d3e02',
  active: true,
  name: [{ given: ['Olivia', 'Grace'], family: 'Bennet' }],
  birthDate: '2016-04-12',
  gender: 'female',
  address: [{ line: ['412 Maple Avenue', 'Apt 3B'], city: 'Brooklyn', state: 'NY', postalCode: '11215' }],
  telecom: [
    { system: 'phone', value: '+12125550142' },
    { system: 'email', value: 'obennett.family@example.com' },
  ],
  contact: [{ telecom: [{ system: 'phone', value: '+12125550199' }] }],
  extension: [{ url: 'https://fhir.zapehr.com/r4/StructureDefinitions/form-user', valueString: 'Parent/Guardian' }],
};

export const bundleOf = (resources: unknown[]): unknown => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({ resource })),
});

const svg = (label: string, bg: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="573" viewBox="0 0 900 573"><rect width="900" height="573" rx="28" fill="${bg}"/><rect x="50" y="60" width="220" height="280" rx="12" fill="#ffffff" opacity="0.7"/><rect x="310" y="80" width="480" height="36" rx="6" fill="#ffffff" opacity="0.8"/><rect x="310" y="150" width="380" height="26" rx="6" fill="#ffffff" opacity="0.6"/><rect x="310" y="200" width="420" height="26" rx="6" fill="#ffffff" opacity="0.6"/><text x="50" y="500" font-family="sans-serif" font-size="44" fill="#ffffff">${label}</text></svg>`
  )}`;

/** Placeholder images (inline data URIs — the capture sandbox blocks all external requests). */
export const placeholderImage = {
  front: svg('Placeholder card - front', '#4d6fa8'),
  back: svg('Placeholder card - back', '#6a8f6b'),
};
