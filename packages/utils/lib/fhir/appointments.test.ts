import { Appointment } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  getCancellationReasonDisplay,
  getReasonForVisitAndAdditionalDetailsFromAppointment,
  getReasonForVisitFromAppointment,
} from './appointments';

describe('appointments', () => {
  describe('getReasonForVisitFromAppointment', () => {
    it('should return trimmed comma-separated reasons', () => {
      const appt = { description: 'Cough, Fever, Headache' } as Appointment;
      expect(getReasonForVisitFromAppointment(appt)).toBe('Cough, Fever, Headache');
    });

    it('should trim whitespace from each complaint', () => {
      const appt = { description: '  Cough ,  Fever  ' } as Appointment;
      expect(getReasonForVisitFromAppointment(appt)).toBe('Cough, Fever');
    });

    it('should return undefined when no description', () => {
      expect(getReasonForVisitFromAppointment({} as Appointment)).toBeUndefined();
      expect(getReasonForVisitFromAppointment(undefined)).toBeUndefined();
    });
  });

  describe('getReasonForVisitAndAdditionalDetailsFromAppointment', () => {
    it('should return empty object when no description', () => {
      expect(getReasonForVisitAndAdditionalDetailsFromAppointment(undefined)).toEqual({});
      expect(getReasonForVisitAndAdditionalDetailsFromAppointment({} as Appointment)).toEqual({});
    });

    it('should return reason only when no separator', () => {
      // The separator is REASON_FOR_VISIT_SEPARATOR - need to know what it is
      // From the code: splits on REASON_FOR_VISIT_SEPARATOR
      const appt = { description: 'Cough' } as Appointment;
      const result = getReasonForVisitAndAdditionalDetailsFromAppointment(appt);
      expect(result.reasonForVisit).toBe('Cough');
    });
  });

  describe('getCancellationReasonDisplay', () => {
    it('should return undefined when no appointment', () => {
      expect(getCancellationReasonDisplay(undefined)).toBeUndefined();
    });

    it('should return undefined when no cancellation reason', () => {
      expect(getCancellationReasonDisplay({} as Appointment)).toBeUndefined();
    });

    it('should return display text from cancellation reason', () => {
      const appt = {
        cancelationReason: {
          coding: [{ display: 'Patient request' }],
        },
      } as unknown as Appointment;
      expect(getCancellationReasonDisplay(appt)).toBe('Patient request');
    });

    it('should append additional info when present', () => {
      const appt = {
        cancelationReason: {
          coding: [
            {
              display: 'Patient request',
              extension: [
                {
                  url: 'https://fhir.zapehr.com/StructureDefinition/cancellation-reason-additional-info',
                  valueString: 'Scheduling conflict',
                },
              ],
            },
          ],
        },
      } as unknown as Appointment;
      expect(getCancellationReasonDisplay(appt)).toBe('Patient request - Scheduling conflict');
    });
  });
});
