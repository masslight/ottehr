import { APPOINTMENT_NOT_FOUND_ERROR } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import { index } from '../../src/patient/video-chat-invites/list-invites/index';

const { sendErrors, getVideoEncounterForAppointment } = vi.hoisted(() => ({
  sendErrors: vi.fn().mockResolvedValue(undefined),
  getVideoEncounterForAppointment: vi.fn(),
}));
vi.mock('../../src/shared/errors', () => ({ sendErrors }));
vi.mock('../../src/shared/auth', () => ({ getUser: vi.fn().mockResolvedValue({ name: 'user' }) }));
vi.mock('../../src/shared/getAuth0Token', () => ({ getAuth0Token: vi.fn().mockResolvedValue('token') }));
vi.mock('../../src/shared/encounters', () => ({ getVideoEncounterForAppointment }));
vi.mock('utils/lib/fhir/appointments', () => ({
  getAppointmentResourceById: vi.fn().mockResolvedValue({ resourceType: 'Appointment', id: 'appointment-1' }),
}));

describe('video-chat-invites-list handler', () => {
  it('returns 404 APPOINTMENT_NOT_FOUND without reporting an error when the appointment has no video encounter', async () => {
    getVideoEncounterForAppointment.mockResolvedValue(undefined);

    const response = await index(
      {
        headers: { Authorization: 'Bearer patient-token' },
        body: JSON.stringify({ appointmentId: 'appointment-1' }),
        secrets: { ENVIRONMENT: 'local', FHIR_API: 'https://fhir.example', PROJECT_API: 'https://project.example' },
      } as any,
      undefined as any,
      () => undefined
    );

    expect(response?.statusCode).toBe(404);
    expect(JSON.parse(response!.body)).toEqual(APPOINTMENT_NOT_FOUND_ERROR);
    expect(sendErrors).not.toHaveBeenCalled();
  });
});
