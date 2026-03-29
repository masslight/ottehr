import { Appointment } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  getAppointmentModuleType,
  isInPersonAppointment,
  isTelemedAppointment,
  OTTEHR_MODULE,
} from './moduleIdentification';

describe('moduleIdentification', () => {
  describe('getAppointmentModuleType', () => {
    it('should return IP for in-person appointment', () => {
      const appt = {
        meta: { tag: [{ code: OTTEHR_MODULE.IP }] },
      } as unknown as Appointment;
      expect(getAppointmentModuleType(appt)).toBe(OTTEHR_MODULE.IP);
    });

    it('should return TM for telemed appointment', () => {
      const appt = {
        meta: { tag: [{ code: OTTEHR_MODULE.TM }] },
      } as unknown as Appointment;
      expect(getAppointmentModuleType(appt)).toBe(OTTEHR_MODULE.TM);
    });

    it('should return undefined for unknown tags', () => {
      const appt = {
        meta: { tag: [{ code: 'OTHER' }] },
      } as unknown as Appointment;
      expect(getAppointmentModuleType(appt)).toBeUndefined();
    });

    it('should return undefined when no tags', () => {
      const appt = {} as Appointment;
      expect(getAppointmentModuleType(appt)).toBeUndefined();
    });

    it('should return undefined for undefined appointment', () => {
      expect(getAppointmentModuleType(undefined)).toBeUndefined();
    });
  });

  describe('isInPersonAppointment', () => {
    it('should return true for IP appointment', () => {
      const appt = { meta: { tag: [{ code: OTTEHR_MODULE.IP }] } } as unknown as Appointment;
      expect(isInPersonAppointment(appt)).toBe(true);
    });

    it('should return false for TM appointment', () => {
      const appt = { meta: { tag: [{ code: OTTEHR_MODULE.TM }] } } as unknown as Appointment;
      expect(isInPersonAppointment(appt)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isInPersonAppointment(undefined)).toBe(false);
    });
  });

  describe('isTelemedAppointment', () => {
    it('should return true for TM appointment', () => {
      const appt = { meta: { tag: [{ code: OTTEHR_MODULE.TM }] } } as unknown as Appointment;
      expect(isTelemedAppointment(appt)).toBe(true);
    });

    it('should return false for IP appointment', () => {
      const appt = { meta: { tag: [{ code: OTTEHR_MODULE.IP }] } } as unknown as Appointment;
      expect(isTelemedAppointment(appt)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isTelemedAppointment(undefined)).toBe(false);
    });
  });
});
