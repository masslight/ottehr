import { Person, RelatedPerson } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { PRIVATE_EXTENSION_BASE_URL } from './constants';
import { resolveVerifiedPhone } from './patient';

const loginRp = (id: string): RelatedPerson => ({
  resourceType: 'RelatedPerson',
  id,
  patient: { reference: 'Patient/p1' },
  relationship: [{ coding: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`, code: 'user-relatedperson' }] }],
});
const person = (rpId: string, phone: string, ended = false): Person => ({
  resourceType: 'Person',
  link: [{ target: { reference: `RelatedPerson/${rpId}` } }],
  telecom: [{ system: 'phone', value: phone, ...(ended ? { period: { end: '2020-01-01' } } : {}) }],
});

describe('resolveVerifiedPhone', () => {
  it('returns the single verified phone', () => {
    expect(resolveVerifiedPhone([loginRp('a'), person('a', '+15550001111')])).toEqual({
      status: 'verified',
      phone: '+15550001111',
    });
  });

  it('reports no account when no login RelatedPerson exists', () => {
    expect(resolveVerifiedPhone([])).toEqual({ status: 'no-account' });
  });

  it('reports no account when the only phone has ended', () => {
    expect(resolveVerifiedPhone([loginRp('a'), person('a', '+15550001111', true)])).toEqual({ status: 'no-account' });
  });

  it('reports ambiguity when accounts have different verified phones', () => {
    expect(
      resolveVerifiedPhone([loginRp('a'), loginRp('b'), person('a', '+15550001111'), person('b', '+15550002222')])
    ).toEqual({ status: 'ambiguous', phones: ['+15550001111', '+15550002222'] });
  });
});
