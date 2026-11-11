import { Appointment } from 'fhir/r4b';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { APPOINTMENT_NOT_FOUND_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/patient/video-chat-invites/list-invites/index';

const { sendErrors, getVideoEncounterForAppointment, getAppointmentResourceById } = vi.hoisted(() => ({
  sendErrors: vi.fn().mockResolvedValue(undefined),
  getVideoEncounterForAppointment: vi.fn(),
  getAppointmentResourceById: vi.fn(),
}));
vi.mock('../../src/shared/errors', () => ({ sendErrors }));
vi.mock('../../src/shared/auth', () => ({ getUser: vi.fn().mockResolvedValue({ name: 'user' }) }));
vi.mock('../../src/shared/getAuth0Token', () => ({ getAuth0Token: vi.fn().mockResolvedValue('token') }));
vi.mock('../../src/shared/encounters', () => ({ getVideoEncounterForAppointment }));
vi.mock('utils/lib/fhir/appointments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/fhir/appointments')>()),
  getAppointmentResourceById,
}));

const appointment = (module: OTTEHR_MODULE): Appointment => ({
  resourceType: 'Appointment',
  id: 'appointment-1',
  status: 'arrived',
  participant: [],
  meta: { tag: [{ code: module }] },
});

const callHandler = (): ReturnType<typeof index> =>
  index(
    {
      headers: { Authorization: 'Bearer patient-token' },
      body: JSON.stringify({ appointmentId: 'appointment-1' }),
      secrets: { ENVIRONMENT: 'local', FHIR_API: 'https://fhir.example', PROJECT_API: 'https://project.example' },
    } as any,
    undefined as any,
    () => undefined
  );

describe('video-chat-invites-list handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getVideoEncounterForAppointment.mockResolvedValue(undefined);
  });

  it('returns 404 APPOINTMENT_NOT_FOUND without reporting an error for an in-person appointment', async () => {
    getAppointmentResourceById.mockResolvedValue(appointment(OTTEHR_MODULE.IP));

    const response = await callHandler();

    expect(response?.statusCode).toBe(404);
    expect(JSON.parse(response!.body)).toEqual(APPOINTMENT_NOT_FOUND_ERROR);
    expect(sendErrors).not.toHaveBeenCalled();
  });

  it('still reports a telemed appointment that has no video encounter', async () => {
    getAppointmentResourceById.mockResolvedValue(appointment(OTTEHR_MODULE.TM));

    const response = await callHandler();

    expect(response?.statusCode).toBe(500);
    expect(sendErrors).toHaveBeenCalled();
  });
});
