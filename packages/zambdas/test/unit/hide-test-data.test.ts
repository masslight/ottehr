import { Appointment } from 'fhir/r4b';
import { hardDeleteAllowed, hasHiddenTestTag, OTTEHR_TEST_DATA_HIDDEN_TAG } from 'utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// These pure helpers underpin the production-safe smoke-test cleanup:
// - hasHiddenTestTag is exactly the predicate the EHR tracking board (get-appointments) uses to
//   exclude reversibly-hidden test appointments.
// - hardDeleteAllowed is the gate that keeps cleanup safe-by-default: it only permits hard deletion
//   when explicitly opted in, so production (where ALLOW_HARD_DELETE is never set) only ever hides.

describe('hasHiddenTestTag', () => {
  it('is true when the appointment carries the hidden test-data tag', () => {
    const appointment: Appointment = {
      resourceType: 'Appointment',
      status: 'booked',
      participant: [],
      meta: { tag: [OTTEHR_TEST_DATA_HIDDEN_TAG] },
    };
    expect(hasHiddenTestTag(appointment)).toBe(true);
  });

  it('is false when the appointment has no tags or unrelated tags', () => {
    expect(hasHiddenTestTag({ resourceType: 'Appointment', status: 'booked', participant: [] } as Appointment)).toBe(
      false
    );
    expect(hasHiddenTestTag({ meta: { tag: [] } })).toBe(false);
    expect(hasHiddenTestTag({ meta: { tag: [{ system: 'something-else', code: 'X' }] } })).toBe(false);
  });
});

describe('hardDeleteAllowed', () => {
  const originalEnv = process.env.ALLOW_HARD_DELETE;
  beforeEach(() => {
    delete process.env.ALLOW_HARD_DELETE;
  });
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ALLOW_HARD_DELETE;
    } else {
      process.env.ALLOW_HARD_DELETE = originalEnv;
    }
  });

  it('defaults to false (safe-by-default) when nothing is set', () => {
    expect(hardDeleteAllowed()).toBe(false);
  });

  it('is true only when ALLOW_HARD_DELETE is exactly "true"', () => {
    process.env.ALLOW_HARD_DELETE = 'true';
    expect(hardDeleteAllowed()).toBe(true);

    process.env.ALLOW_HARD_DELETE = 'false';
    expect(hardDeleteAllowed()).toBe(false);

    process.env.ALLOW_HARD_DELETE = '1';
    expect(hardDeleteAllowed()).toBe(false);
  });

  it('honors an explicit override regardless of the environment', () => {
    process.env.ALLOW_HARD_DELETE = 'true';
    expect(hardDeleteAllowed(false)).toBe(false);

    delete process.env.ALLOW_HARD_DELETE;
    expect(hardDeleteAllowed(true)).toBe(true);
  });
});
