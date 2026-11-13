// Shared mock data for the visits-a stories (not a story itself).
import type { Appointment, Encounter, Location, Patient, QuestionnaireResponse } from 'fhir/r4b';
import type { FetchMock } from '../../harness/story';

export const APPOINTMENT_ID = '0b1f6a52-6f4e-4a55-9d0e-3a5d2c9b7a01';
export const ENCOUNTER_ID = '6c0f4f0e-2f0b-4d0c-8a3e-0d7a6f1e2b02';
export const PATIENT_ID = '9a4c2d7e-1b3f-4c5d-8e6f-7a8b9c0d1e03';
export const LOCATION_ID = '3d2e1f0a-9b8c-4d7e-a6f5-4e3d2c1b0a04';

export const patient: Patient = {
  resourceType: 'Patient',
  id: PATIENT_ID,
  active: true,
  name: [{ given: ['Jane'], family: 'Doe' }],
  birthDate: '1990-04-12',
  gender: 'female',
};

export const location: Location = {
  resourceType: 'Location',
  id: LOCATION_ID,
  status: 'active',
  name: 'Main Street Clinic',
  address: { state: 'NY' },
};

export const appointment: Appointment = {
  resourceType: 'Appointment',
  id: APPOINTMENT_ID,
  status: 'arrived',
  start: '2026-11-13T15:00:00.000Z',
  end: '2026-11-13T15:15:00.000Z',
  participant: [
    { actor: { reference: `Patient/${PATIENT_ID}` }, status: 'accepted' },
    { actor: { reference: `Location/${LOCATION_ID}` }, status: 'accepted' },
  ],
};

export const encounter: Encounter = {
  resourceType: 'Encounter',
  id: ENCOUNTER_ID,
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'ACUTE', display: 'inpatient acute' },
  subject: { reference: `Patient/${PATIENT_ID}` },
  appointment: [{ reference: `Appointment/${APPOINTMENT_ID}` }],
  location: [{ location: { reference: `Location/${LOCATION_ID}` } }],
};

export const questionnaireResponse: QuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse',
  id: '5e4d3c2b-1a0f-4e9d-8c7b-6a5f4e3d2c05',
  status: 'completed',
  questionnaire: 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson|1.0.0',
  encounter: { reference: `Encounter/${ENCOUNTER_ID}` },
  item: [
    {
      linkId: 'contact-information-page',
      item: [{ linkId: 'patient-number', answer: [{ valueString: '(212) 555-0147' }] }],
    },
  ],
};

const bundle = (resources: unknown[]): unknown => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({ resource })),
});

/** Answers useAppointmentData's Appointment search with a small in-person visit graph. */
export const appointmentMock = (patientOverride: Patient = patient): FetchMock => ({
  url: /\/fhir\/Appointment/,
  response: bundle([appointment, patientOverride, location, encounter, questionnaireResponse]),
});

export const PRACTITIONER_ID = 'c7b6a5f4-e3d2-4c1b-a0f9-8e7d6c5b4a06';

const practitioner = {
  resourceType: 'Practitioner',
  id: PRACTITIONER_ID,
  active: true,
  name: [{ given: ['Dana'], family: 'Whitfield', suffix: ['MD'] }],
  telecom: [{ system: 'sms', value: '+12125550142' }],
  identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567893' }],
};

/** Signed-in user (useEvolveUser) + the visit graph. Pass roles to change the user's roles. */
export const visitMocks = (roles: string[] = ['Provider'], patientOverride: Patient = patient): FetchMock[] => [
  {
    url: /\/user\/me\b/,
    response: {
      id: 'user-1',
      name: 'dana.whitfield@example.com',
      email: 'dana.whitfield@example.com',
      profile: `Practitioner/${PRACTITIONER_ID}`,
      roles: roles.map((name, index) => ({ id: `role-${index}`, name })),
    },
  },
  { url: `/Practitioner/${PRACTITIONER_ID}`, response: practitioner },
  appointmentMock(patientOverride),
];

/** Route props for components that read the appointment id from the URL. */
export const visitRoute = {
  route: `/in-person/${APPOINTMENT_ID}/progress-note`,
  routePath: '/in-person/:id/*',
};

/** Answers the notes chart section (GenericNoteList) with two notes of the given type. */
export const notesMock = (type: string): FetchMock => ({
  url: /get-chart-section/,
  response: {
    status: 200,
    output: {
      data: {
        notes: [
          {
            resourceId: 'note-1',
            type,
            text: 'Patient arrived with mother. Reports sore throat for 3 days, no fever this morning.',
            authorId: 'practitioner-1',
            authorName: 'Alex Morgan, RN',
            lastUpdated: '2026-11-13T15:04:00.000Z',
            encounterId: ENCOUNTER_ID,
            patientId: PATIENT_ID,
          },
          {
            resourceId: 'note-2',
            type,
            text: 'Rapid strep swab collected, result pending.',
            authorId: 'practitioner-2',
            authorName: 'Sam Rivera, MA',
            lastUpdated: '2026-11-13T15:21:00.000Z',
            encounterId: ENCOUNTER_ID,
            patientId: PATIENT_ID,
          },
        ],
      },
    },
  },
});
