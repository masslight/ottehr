import { Appointment } from 'fhir/r4b';
import { OTTEHR_MODULE } from 'utils';
import { describe, expect, test } from 'vitest';
import { isOnDemandVirtualAppointment } from '../src/shared';

const makeAppointment = (module: OTTEHR_MODULE, appointmentTypeText?: string): Appointment => ({
  resourceType: 'Appointment',
  status: 'booked',
  participant: [],
  meta: {
    tag: [{ code: module }],
  },
  ...(appointmentTypeText && {
    appointmentType: {
      text: appointmentTypeText,
    },
  }),
});

describe('isOnDemandVirtualAppointment', () => {
  test('returns true for a telemed walk-in appointment', () => {
    expect(isOnDemandVirtualAppointment(makeAppointment(OTTEHR_MODULE.TM, 'walkin'))).toBe(true);
  });

  test('returns true for a telemed appointment with no appointmentType (defaults to walk-in)', () => {
    expect(isOnDemandVirtualAppointment(makeAppointment(OTTEHR_MODULE.TM))).toBe(true);
  });

  test('returns false for a pre-booked telemed appointment', () => {
    expect(isOnDemandVirtualAppointment(makeAppointment(OTTEHR_MODULE.TM, 'prebook'))).toBe(false);
  });

  test('returns false for a post-telemed appointment', () => {
    expect(isOnDemandVirtualAppointment(makeAppointment(OTTEHR_MODULE.TM, 'posttelemed'))).toBe(false);
  });

  test('returns false for an in-person walk-in appointment', () => {
    expect(isOnDemandVirtualAppointment(makeAppointment(OTTEHR_MODULE.IP, 'walkin'))).toBe(false);
  });

  test('returns false for a pre-booked in-person appointment', () => {
    expect(isOnDemandVirtualAppointment(makeAppointment(OTTEHR_MODULE.IP, 'prebook'))).toBe(false);
  });
});
