// Shared mock visit for the visits-b stories (not a story: the harness only globs *.story.tsx).
// Everything here is answered through the harness fetch mock, so the real appointment store,
// useEvolveUser and useVisitNote/useChartData code paths run unmodified.
import type { Appointment, Encounter, Location, Patient, Practitioner } from 'fhir/r4b';
import { APPOINTMENT_LOCKED_META_TAG } from 'utils/lib/fhir/constants';
import type { FetchMock } from '../../harness/story';

export const APPOINTMENT_ID = 'appt-1';
export const ENCOUNTER_ID = 'enc-1';
export const PATIENT_ID = 'pat-1';
export const PRACTITIONER_ID = 'prac-1';

/** Route props for components that read the appointment id from the URL. */
export const visitRoute = {
  route: `/in-person/${APPOINTMENT_ID}/review-and-sign`,
  routePath: '/in-person/:id/*',
};

export interface VisitMockOptions {
  /** Appointment carries the "locked" meta tag (signed visit, chart read-only). */
  locked?: boolean;
  /** Roles of the signed-in user. */
  roles?: string[];
  /** Deep-ish overrides merged into the visit note (per top-level key). */
  note?: Record<string, unknown>;
  extra?: FetchMock[];
}

const practitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: PRACTITIONER_ID,
  active: true,
  name: [{ given: ['Dana'], family: 'Whitfield', suffix: ['MD'] }],
  telecom: [{ system: 'sms', value: '+12125550142' }],
  identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567893' }],
};

const patient: Patient = {
  resourceType: 'Patient',
  id: PATIENT_ID,
  name: [{ given: ['Lucas'], family: 'Alvarez' }],
  birthDate: '2017-07-22',
  gender: 'male',
};

const location: Location = {
  resourceType: 'Location',
  id: 'loc-1',
  name: 'Brooklyn Urgent Care',
  status: 'active',
  address: { state: 'NY', city: 'Brooklyn' },
};

const buildAppointment = (locked: boolean): Appointment => ({
  resourceType: 'Appointment',
  id: APPOINTMENT_ID,
  status: 'fulfilled',
  start: '2026-11-12T15:00:00.000Z',
  end: '2026-11-12T15:15:00.000Z',
  meta: {
    tag: [{ code: 'OTTEHR-IP' }, ...(locked ? [APPOINTMENT_LOCKED_META_TAG] : [])],
  },
  participant: [
    { actor: { reference: `Patient/${PATIENT_ID}` }, status: 'accepted' },
    { actor: { reference: 'Location/loc-1' }, status: 'accepted' },
  ],
});

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: ENCOUNTER_ID,
  // in-progress + an ended attender period = "discharged", the state a note is signed from
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'ACUTE' },
  subject: { reference: `Patient/${PATIENT_ID}` },
  appointment: [{ reference: `Appointment/${APPOINTMENT_ID}` }],
  location: [{ location: { reference: 'Location/loc-1' } }],
  participant: [
    {
      type: [
        {
          coding: [
            { system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ATND', display: 'attender' },
          ],
        },
      ],
      individual: { reference: `Practitioner/${PRACTITIONER_ID}` },
      period: { start: '2026-11-12T15:05:00.000Z', end: '2026-11-12T15:40:00.000Z' },
    },
  ],
};

export const baseVisitNote = (): Record<string, any> => ({
  patientId: PATIENT_ID,
  encounterNotes: {
    chiefComplaint: { resourceId: 'cc-1', text: 'Sore throat and fever for two days. No cough.' },
    medicalDecision: { resourceId: 'mdm-1', text: 'Rapid strep positive. Treat with amoxicillin, supportive care.' },
    patientInfoConfirmed: { resourceId: 'pic-1', value: true },
  },
  history: {
    allergies: [],
    conditions: [],
    medications: [],
    inhouseMedications: [],
    surgicalHistory: [],
    episodeOfCare: [],
    birthHistory: [],
    medicationsInformationSourcePractitioners: [],
  },
  screening: { observations: [] },
  exam: { examObservations: [], rosObservations: [] },
  assessment: {
    diagnosis: [
      { resourceId: 'dx-1', code: 'J02.0', display: 'Streptococcal pharyngitis', isPrimary: true },
      { resourceId: 'dx-2', code: 'R50.9', display: 'Fever, unspecified', isPrimary: false },
    ],
    cptCodes: [],
    emCode: { resourceId: 'em-1', code: '99213', display: 'Office or other outpatient visit, established patient' },
    procedures: [],
  },
  plan: {
    instructions: [{ resourceId: 'ins-1', text: 'Rest, fluids, and finish the full course of antibiotics.' }],
    schoolWorkNotes: [],
    prescribedMedications: [],
    preferredPharmacies: [],
    prescribedMedicationsRequesterPractitioners: [],
  },
  notes: { notes: [] },
  aiChat: { aiChat: { documents: [], providers: [] }, observations: [] },
  vitalsObservations: [],
  externalLabResults: { labOrderResults: [], resultsPending: false },
  inHouseLabResults: { labOrderResults: [], resultsPending: false },
  radiologyOrders: [],
  practitioners: [practitioner],
  patientHasPreviousVisits: false,
});

const bundle = (resources: unknown[]): unknown => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({ resource })),
});

export const visitMocks = (options: VisitMockOptions = {}): FetchMock[] => {
  const { locked = false, roles = ['Provider'], note = {}, extra = [] } = options;
  const visitNote = { ...baseVisitNote(), ...note };
  return [
    ...extra,
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
    {
      url: /\/fhir\/Appointment(\?|\/_search|$)/,
      response: bundle([buildAppointment(locked), patient, location, encounter, practitioner]),
    },
    { url: 'get-visit-note', response: { status: 200, output: visitNote } },
    {
      url: 'get-chart-section',
      response: ({ body }: { body: any }) => ({ status: 200, output: { data: visitNote[body?.section] } }),
    },
    {
      url: 'get-employees',
      response: {
        status: 200,
        output: {
          employees: [
            {
              id: 'user-1',
              profile: `Practitioner/${PRACTITIONER_ID}`,
              name: 'Dana Whitfield',
              firstName: 'Dana',
              lastName: 'Whitfield',
              status: 'Active',
              isProvider: true,
              isCustomerSupport: false,
              roles: ['Provider'],
            },
          ],
        },
      },
    },
    { url: 'get-progress-note-config', response: { status: 200, output: { mdmRequired: true } } },
  ];
};
