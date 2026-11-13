import type { Appointment, Encounter, Patient, Task } from 'fhir/r4b';
import { createInvoiceTaskInput } from 'utils/lib/helpers/tasks/invoices-tasks';
import type { InvoiceablePatientReport } from 'utils/lib/types/api/invoicing.types';

export const patient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [
    { use: 'official', family: 'Rivera', given: ['Jordan', 'Lee'] },
    { use: 'nickname', given: ['Jo'] },
  ],
  birthDate: '1988-04-12',
  gender: 'female',
  telecom: [
    { system: 'phone', use: 'mobile', rank: 1, value: '+12025550143' },
    { system: 'email', rank: 1, value: 'jordan.rivera@example.com' },
  ],
  address: [{ line: ['418 Maple Avenue', 'Apt 3B'], city: 'Brooklyn', state: 'NY', postalCode: '11201' }],
};

export const appointment: Appointment = {
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'arrived',
  start: '2026-11-13T15:00:00.000Z',
  participant: [{ actor: { reference: 'Patient/patient-1' }, status: 'accepted' }],
};

export const encounter: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'arrived',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  statusHistory: [{ status: 'planned', period: { start: '2026-11-13T14:30:00.000Z' } }],
  subject: { reference: 'Patient/patient-1' },
  appointment: [{ reference: 'Appointment/appt-1' }],
};

const invoiceTask: Task = {
  resourceType: 'Task',
  id: '6f1c2f0e-7b0a-4f5e-9d0a-2f0a8c1b7e11',
  status: 'ready',
  intent: 'order',
  encounter: { reference: 'Encounter/enc-1' },
  input: createInvoiceTaskInput({ amountCents: 12500 }),
};

export const invoiceReport: InvoiceablePatientReport = {
  claimId: 'claim-1',
  finalizationDateISO: '2026-11-02T16:00:00.000Z',
  amountInvoiceable: 125,
  task: invoiceTask,
  visitDate: '2026-10-28',
  location: 'Brooklyn Urgent Care',
  appointmentId: 'appt-1',
  patient: {
    patientId: 'patient-1',
    fullName: 'Jordan Rivera',
    dob: '04/12/1988',
    gender: 'Female',
    phoneNumber: '(202) 555-0143',
    fullAddress: '418 Maple Avenue, Brooklyn, NY 11201',
    city: 'Brooklyn',
    state: 'NY',
  },
  responsibleParty: {
    fullName: 'Jordan Rivera',
    phoneNumber: '(202) 555-0143',
    email: 'jordan.rivera@example.com',
    relationshipToPatient: 'Self',
    fullAddress: '418 Maple Avenue, Brooklyn, NY 11201',
    city: 'Brooklyn',
    state: 'NY',
  },
};
