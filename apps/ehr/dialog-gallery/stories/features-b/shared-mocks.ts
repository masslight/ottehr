import { Appointment, Encounter, Location, Patient, Practitioner, Task } from 'fhir/r4b';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { FAX_TASK } from 'utils/lib/types/data/tasks/types';
import type { FetchMock } from '../../harness/story';

const bundle = (resources: unknown[]): unknown => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({ resource, search: { mode: 'match' } })),
});

export const mockPractitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'practitioner-1',
  name: [{ given: ['Olivia'], family: 'Bennett', suffix: ['MD'] }],
  telecom: [{ system: 'sms', value: '+12025550143' }],
};

/** Signed-in user: an Administrator + Provider whose profile is `mockPractitioner`. */
export const userMocks: FetchMock[] = [
  {
    url: /\/user\/me\b/,
    response: {
      id: 'user-1',
      name: 'gallery.user@example.com',
      email: 'gallery.user@example.com',
      profile: 'Practitioner/practitioner-1',
      roles: [
        { id: 'role-admin', name: 'Administrator' },
        { id: 'role-provider', name: 'Provider' },
      ],
    },
  },
  { url: /\/fhir\/Practitioner\/practitioner-1\b/, response: mockPractitioner },
];

export const mockPatient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ given: ['Jordan'], family: 'Alvarez' }],
  birthDate: '2015-04-12',
  gender: 'male',
};

export const mockLocation: Location = {
  resourceType: 'Location',
  id: 'location-1',
  name: 'Downtown Urgent Care',
  status: 'active',
  address: { line: ['120 Main Street'], city: 'Springfield', state: 'NY', postalCode: '12345' },
};

export const mockAppointment: Appointment = {
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'arrived',
  start: '2026-11-10T15:00:00.000Z',
  participant: [
    { actor: { reference: 'Patient/patient-1' }, status: 'accepted' },
    { actor: { reference: 'Location/location-1' }, status: 'accepted' },
  ],
};

export const mockEncounter: Encounter = {
  resourceType: 'Encounter',
  id: 'encounter-1',
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  subject: { reference: 'Patient/patient-1' },
  appointment: [{ reference: 'Appointment/appt-1' }],
};

/** Answers the chart's appointment search (useAppointmentData) for appointment `appt-1`. */
export const appointmentMocks: FetchMock[] = [
  {
    url: /\/fhir\/Appointment\b/,
    response: bundle([mockAppointment, mockPatient, mockLocation, mockEncounter]),
  },
];

const faxInput = (code: string, valueString: string): NonNullable<Task['input']>[number] => ({
  type: { coding: [{ system: TASK_INPUT_SYSTEM, code }] },
  valueString,
});

/** An open inbound-fax task assigned to the signed-in practitioner. */
export const mockFaxTask: Task = {
  resourceType: 'Task',
  id: 'task-fax-1',
  status: 'in-progress',
  intent: 'order',
  authoredOn: '2026-11-12T14:05:00.000Z',
  description: 'Inbound fax from +1 (212) 555-0188 (4 pages)',
  groupIdentifier: { value: FAX_TASK.category },
  code: { coding: [{ system: FAX_TASK.system, code: FAX_TASK.code.matchInboundFax }] },
  basedOn: [{ reference: 'Communication/comm-1' }],
  owner: { reference: 'Practitioner/practitioner-1', display: 'Olivia Bennett, MD' },
  input: [
    faxInput(FAX_TASK.input.senderFaxNumber, '+12125550188'),
    faxInput(FAX_TASK.input.pageCount, '4'),
    faxInput(FAX_TASK.input.communicationId, 'comm-1'),
    faxInput(FAX_TASK.input.pdfUrl, 'https://mock.invalid/z3/inbound-fax/comm-1.pdf'),
    faxInput(FAX_TASK.input.receivedDate, '2026-11-12T14:04:00.000Z'),
  ],
};

export const faxTaskMocks: FetchMock[] = [
  { url: /\/fhir\/Task\b/, response: bundle([mockFaxTask]) },
  { url: 'inbound-fax/comm-1.pdf', response: { signedUrl: 'about:blank' } },
];

export const fhirBundle = bundle;
