import { describe, expect, test } from 'vitest';
import { getVideoCallAppointmentId } from './video-chat-helpers';

describe('getVideoCallAppointmentId', () => {
  test('reads invited video call appointment_id param', () => {
    expect(getVideoCallAppointmentId(new URLSearchParams('appointment_id=invited-appt'))).toBe('invited-appt');
  });

  test('returns undefined when no appointment id param exists', () => {
    expect(getVideoCallAppointmentId(new URLSearchParams('token=abc'))).toBeUndefined();
  });
});
