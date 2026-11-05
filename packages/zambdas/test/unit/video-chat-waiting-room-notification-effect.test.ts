import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Patient } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTelemedRequiredAppointmentEncounterExtensions } from '../../src/patient/appointment/helpers';
import { performEffect } from '../../src/patient/video-chat-invites/create-waiting-room-notification-task/index';

const appointmentId = 'appointment-1';
const patient: Patient = { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Test'], family: 'Patient' }] };
const { encExtensions } = getTelemedRequiredAppointmentEncounterExtensions('Patient/patient-1', '2026-01-01T00:00:00Z');

const appointment = (status: Appointment['status']): Appointment => ({
  resourceType: 'Appointment',
  id: appointmentId,
  status,
  participant: [{ actor: { reference: 'Patient/patient-1' }, status: 'accepted' }],
});
const encounter = (id: string, status: Encounter['status'], video: boolean): Encounter => ({
  resourceType: 'Encounter',
  id,
  status,
  class: { code: video ? 'VR' : 'ACUTE' },
  appointment: [{ reference: `Appointment/${appointmentId}` }],
  ...(video ? { extension: encExtensions } : {}),
});

const client = {
  fhir: { search: vi.fn(), create: vi.fn(), transaction: vi.fn(), get: vi.fn() },
};
const run = (resources: (Appointment | Encounter | Patient)[]): ReturnType<typeof performEffect> => {
  client.fhir.search.mockResolvedValue({ unbundle: () => resources });
  return performEffect({ body: { appointmentId }, secrets: null } as any, client as unknown as Oystehr);
};

describe('video-chat-waiting-room-notification performEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.fhir.create.mockResolvedValue({ resourceType: 'Task', id: 'task-1' });
    client.fhir.transaction.mockResolvedValue({});
  });

  it('does not create a task for an in-person appointment (no video encounter)', async () => {
    const result = await run([appointment('booked'), encounter('enc-in-person', 'planned', false), patient]);
    expect(result.taskCreated).toBe(false);
    expect(client.fhir.create).not.toHaveBeenCalled();
  });

  it('does not create a task for a finished visit', async () => {
    const result = await run([appointment('fulfilled'), encounter('enc-video', 'finished', true), patient]);
    expect(result.taskCreated).toBe(false);
    expect(client.fhir.create).not.toHaveBeenCalled();
  });

  it('creates a task for a visit already with the provider (fulfilled appointment, in-progress encounter)', async () => {
    const result = await run([appointment('fulfilled'), encounter('enc-video', 'in-progress', true), patient]);
    expect(result.taskCreated).toBe(true);
  });

  it('creates the task against the video encounter when other encounters come first', async () => {
    const result = await run([
      appointment('booked'),
      encounter('enc-follow-up', 'finished', false),
      encounter('enc-video', 'planned', true),
      patient,
    ]);
    expect(result.taskCreated).toBe(true);
    expect(client.fhir.create.mock.calls[0][0].encounter).toEqual({ reference: 'Encounter/enc-video' });
  });
});
