// Mock virtual visit for the video-call stories (not a story: the harness only globs *.story.tsx).
import type { Appointment, Encounter, Location, Patient, QuestionnaireResponse } from 'fhir/r4b';
import type { FetchMock } from '../../harness/story';

export const APPOINTMENT_ID = 'appt-1';
const ENCOUNTER_ID = 'enc-1';
const PATIENT_ID = 'pat-1';
const LOCATION_ID = 'loc-1';

/** Route props for components that read the appointment id from the URL. */
export const visitRoute = {
  route: `/in-person/${APPOINTMENT_ID}/progress-note`,
  routePath: '/in-person/:id/*',
};

const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

const patient: Patient = {
  resourceType: 'Patient',
  id: PATIENT_ID,
  active: true,
  name: [{ given: ['Maya'], family: 'Thompson' }],
  birthDate: '1988-03-14',
  gender: 'female',
};

const location: Location = {
  resourceType: 'Location',
  id: LOCATION_ID,
  status: 'active',
  name: 'New York Virtual Care',
  address: { state: 'NY' },
};

const appointment = (): Appointment => ({
  resourceType: 'Appointment',
  id: APPOINTMENT_ID,
  status: 'arrived',
  start: minutesAgo(20),
  end: minutesAgo(-10),
  participant: [
    { actor: { reference: `Patient/${PATIENT_ID}` }, status: 'accepted' },
    { actor: { reference: `Location/${LOCATION_ID}` }, status: 'accepted' },
  ],
});

const encounter = (): Encounter => ({
  resourceType: 'Encounter',
  id: ENCOUNTER_ID,
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'ACUTE', display: 'inpatient acute' },
  subject: { reference: `Patient/${PATIENT_ID}` },
  appointment: [{ reference: `Appointment/${APPOINTMENT_ID}` }],
  location: [{ location: { reference: `Location/${LOCATION_ID}` } }],
  statusHistory: [
    { status: 'arrived', period: { start: minutesAgo(15), end: minutesAgo(7) } },
    { status: 'in-progress', period: { start: minutesAgo(7) } },
  ],
});

const questionnaireResponse: QuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse',
  id: 'qr-1',
  status: 'completed',
  questionnaire: 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson|1.0.0',
  encounter: { reference: `Encounter/${ENCOUNTER_ID}` },
  item: [
    {
      linkId: 'contact-information-page',
      item: [
        { linkId: 'patient-number', answer: [{ valueString: '(212) 555-0147' }] },
        { linkId: 'preferred-language', answer: [{ valueString: 'English' }] },
      ],
    },
  ],
};

const bundle = (resources: unknown[]): unknown => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({ resource })),
});

/** Answers useAppointmentData's Appointment search and useEvolveUser's user lookup. */
export const visitMocks = (): FetchMock[] => [
  {
    url: /\/user\/me\b/,
    response: {
      id: 'user-1',
      name: 'dana.whitfield@example.com',
      email: 'dana.whitfield@example.com',
      profile: 'Practitioner/prac-1',
      roles: [{ id: 'role-1', name: 'Provider' }],
    },
  },
  {
    url: /\/fhir\/Appointment/,
    response: () => bundle([appointment(), patient, location, encounter(), questionnaireResponse]),
  },
];
