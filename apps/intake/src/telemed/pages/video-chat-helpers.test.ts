import { describe, expect, test } from 'vitest';
import { getVideoCallAppointmentId } from './video-chat-helpers';

describe('getVideoCallAppointmentId', () => {
  test('reads invited video call appointment_id param', () => {
    expect(getVideoCallAppointmentId(new URLSearchParams('appointment_id=invited-appt'))).toBe('invited-appt');
  });

  test('reads legacy appointmentID param', () => {
    expect(getVideoCallAppointmentId(new URLSearchParams('appointmentID=legacy-appt'))).toBe('legacy-appt');
  });

  test('prefers legacy appointmentID when both params are present', () => {
    expect(getVideoCallAppointmentId(new URLSearchParams('appointmentID=legacy&appointment_id=invited'))).toBe(
      'legacy'
    );
  });

  test('returns undefined when no appointment id param exists', () => {
    expect(getVideoCallAppointmentId(new URLSearchParams('token=abc'))).toBeUndefined();
  });
});
