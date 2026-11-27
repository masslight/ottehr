/**
 * @vitest-environment node
 */

import { DuplicatePatientCandidate } from 'utils/lib/types/api/check-duplicate-patients.types';
import { describe, expect, it } from 'vitest';
import { getCandidateBlockedReason } from './duplicatePatientCandidates';

const ready: DuplicatePatientCandidate = {
  patientId: 'p1',
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '2015-04-12',
  sex: 'female',
  phone: { status: 'verified', phone: '+15550001111' },
};

describe('getCandidateBlockedReason', () => {
  it('is undefined for a bookable candidate', () => {
    expect(getCandidateBlockedReason(ready)).toBeUndefined();
  });

  it.each([undefined, 'unknown'])('blocks sex %s and says the demographics need correcting', (sex) => {
    expect(getCandidateBlockedReason({ ...ready, sex })).toMatch(/sex is missing or unknown.*Correct it/);
  });

  it('accepts every PersonSex value', () => {
    for (const sex of ['male', 'female', 'other']) {
      expect(getCandidateBlockedReason({ ...ready, sex })).toBeUndefined();
    }
  });

  it('blocks a partial date of birth', () => {
    expect(getCandidateBlockedReason({ ...ready, dateOfBirth: '2015-04' })).toMatch(/date of birth/);
    expect(getCandidateBlockedReason({ ...ready, dateOfBirth: undefined })).toMatch(/date of birth/);
  });

  it('blocks a missing name', () => {
    expect(getCandidateBlockedReason({ ...ready, firstName: ' ' })).toMatch(/first or last name/);
  });

  it.each([{ status: 'no-account' }, { status: 'ambiguous', phones: ['a', 'b'] }, { status: 'error' }, undefined])(
    'blocks phone state %o',
    (phone) => {
      expect(getCandidateBlockedReason({ ...ready, phone: phone as any })).toBeTruthy();
    }
  );

  it('reports every problem at once', () => {
    const reason = getCandidateBlockedReason({ ...ready, sex: undefined, phone: { status: 'no-account' } });
    expect(reason).toMatch(/sex/);
    expect(reason).toMatch(/contact number/);
  });
});
