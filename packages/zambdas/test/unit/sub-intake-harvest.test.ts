import { Appointment } from 'fhir/r4b';
import { FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG } from 'utils';
import { describe, expect, it } from 'vitest';
import { hasHarvestCompleteTag } from '../../src/subscriptions/questionnaire-response/sub-intake-harvest/index';

const makeAppointment = (overrides?: Partial<Appointment>): Appointment => ({
  resourceType: 'Appointment',
  status: 'booked',
  participant: [],
  ...overrides,
});

describe('hasHarvestCompleteTag', () => {
  it('returns true when the harvest-complete tag is present', () => {
    const appointment = makeAppointment({
      meta: { tag: [FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG] },
    });
    expect(hasHarvestCompleteTag(appointment)).toBe(true);
  });

  it('returns true when the harvest-complete tag is one of several tags', () => {
    const appointment = makeAppointment({
      meta: {
        tag: [
          { system: 'appointment-preprocessing-status', code: 'APPOINTMENT_PREPROCESSED' },
          { code: 'OTTEHR-IP' },
          FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG,
        ],
      },
    });
    expect(hasHarvestCompleteTag(appointment)).toBe(true);
  });

  it('returns false when meta is absent', () => {
    const appointment = makeAppointment();
    expect(hasHarvestCompleteTag(appointment)).toBe(false);
  });

  it('returns false when meta has no tag array', () => {
    const appointment = makeAppointment({ meta: {} });
    expect(hasHarvestCompleteTag(appointment)).toBe(false);
  });

  it('returns false when tag array is empty', () => {
    const appointment = makeAppointment({ meta: { tag: [] } });
    expect(hasHarvestCompleteTag(appointment)).toBe(false);
  });

  it('returns false when no tag matches the harvest-complete system+code pair', () => {
    const appointment = makeAppointment({
      meta: {
        tag: [{ system: 'appointment-preprocessing-status', code: 'APPOINTMENT_PREPROCESSED' }, { code: 'OTTEHR-IP' }],
      },
    });
    expect(hasHarvestCompleteTag(appointment)).toBe(false);
  });

  it('returns false when code matches but system does not', () => {
    // Guard against drift: another subsystem could use the same code under a different
    // system. The pair must match.
    const appointment = makeAppointment({
      meta: {
        tag: [
          {
            system: 'some-other-system',
            code: FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG.code,
          },
        ],
      },
    });
    expect(hasHarvestCompleteTag(appointment)).toBe(false);
  });

  it('returns false when system matches but code does not', () => {
    const appointment = makeAppointment({
      meta: {
        tag: [
          {
            system: FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG.system,
            code: 'SOME_OTHER_CODE',
          },
        ],
      },
    });
    expect(hasHarvestCompleteTag(appointment)).toBe(false);
  });
});
