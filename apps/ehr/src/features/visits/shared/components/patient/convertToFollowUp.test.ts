/**
 * @vitest-environment node
 */

import { Encounter } from 'fhir/r4b';
import { FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { describe, expect, it } from 'vitest';
import { getConvertToFollowUpDisabledReason } from './convertToFollowUp';

const visit: Encounter = { resourceType: 'Encounter', id: 'enc-1', status: 'planned', class: { code: 'ACUTE' } };
const followUp: Encounter = {
  ...visit,
  type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] }],
};
const ready = { encounter: visit, isLoading: false, hasOwnFollowUps: false, hasOtherInitialVisits: true };

describe('getConvertToFollowUpDisabledReason', () => {
  it('allows converting a standalone visit when the patient has another visit to follow up on', () => {
    expect(getConvertToFollowUpDisabledReason(ready)).toBeUndefined();
  });

  it('disables converting when the patient has no other visit to follow up on', () => {
    expect(getConvertToFollowUpDisabledReason({ ...ready, hasOtherInitialVisits: false })).toBe(
      'The patient has no other visit to follow up on'
    );
  });

  it('keeps the existing reasons ahead of the missing initial visit', () => {
    const noInitial = { ...ready, hasOtherInitialVisits: false };
    expect(getConvertToFollowUpDisabledReason({ ...noInitial, isLoading: true })).toBe('Loading the visit…');
    expect(getConvertToFollowUpDisabledReason({ ...noInitial, encounter: followUp })).toBe(
      'This visit is already a follow-up'
    );
    expect(getConvertToFollowUpDisabledReason({ ...noInitial, hasOwnFollowUps: true })).toBe(
      'This visit already has its own follow-ups'
    );
  });

  it('waits for the lookup of other visits only once the other reasons are ruled out', () => {
    const lookingUp = { ...ready, hasOtherInitialVisits: undefined };
    expect(getConvertToFollowUpDisabledReason(lookingUp)).toBe('Loading the visit…');
    expect(getConvertToFollowUpDisabledReason({ ...lookingUp, encounter: followUp })).toBe(
      'This visit is already a follow-up'
    );
  });
});
