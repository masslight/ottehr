import { Appointment } from 'fhir/r4b';
import {
  APPOINTMENT_PAPERWORK_SUBTYPE,
  IN_PERSON_INTAKE_PAPERWORK_CANONICAL,
  LITE_INTAKE_PAPERWORK_CANONICAL,
  OTTEHR_MODULE,
  ServiceMode,
  VIRTUAL_INTAKE_PAPERWORK_CANONICAL,
} from 'utils';
import { describe, expect, test } from 'vitest';
import { getCanonicalUrlForPrevisitQuestionnaire } from '../src/patient/appointment/helpers';
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

describe('getCanonicalUrlForPrevisitQuestionnaire', () => {
  test('returns the in-person full intake for in-person mode', () => {
    expect(getCanonicalUrlForPrevisitQuestionnaire(ServiceMode['in-person'])).toBe(
      IN_PERSON_INTAKE_PAPERWORK_CANONICAL
    );
  });

  test('returns the virtual full intake for virtual mode', () => {
    expect(getCanonicalUrlForPrevisitQuestionnaire(ServiceMode.virtual)).toBe(VIRTUAL_INTAKE_PAPERWORK_CANONICAL);
  });

  test('consent-only subtype overrides mode with the lite intake (flow base mapping)', () => {
    expect(
      getCanonicalUrlForPrevisitQuestionnaire(ServiceMode['in-person'], APPOINTMENT_PAPERWORK_SUBTYPE.CONSENT_FORM_ONLY)
    ).toBe(LITE_INTAKE_PAPERWORK_CANONICAL);
    expect(
      getCanonicalUrlForPrevisitQuestionnaire(ServiceMode.virtual, APPOINTMENT_PAPERWORK_SUBTYPE.CONSENT_FORM_ONLY)
    ).toBe(LITE_INTAKE_PAPERWORK_CANONICAL);
  });
});
