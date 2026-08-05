import Oystehr from '@oystehr/sdk';
import { Practitioner } from 'fhir/r4b';
import { FHIR_IDENTIFIER_NPI, NOT_AUTHORIZED } from 'utils';
import { describe, expect, it } from 'vitest';
import { assertPractitionerHasNPI, requirePractitionerNPI } from '../../src/shared/auth';

// Backend enforcement for NPI-gated actions (sign/co-sign notes, e-prescribe, external labs &
// imaging orders, claim submission, in-house medication orders). A user without an NPI on their
// Practitioner (e.g. the Clinician role) must be rejected with NOT_AUTHORIZED.

const practitionerWithNPI: Practitioner = {
  resourceType: 'Practitioner',
  id: 'p-with-npi',
  identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1234567893' }],
};

const practitionerWithoutNPI: Practitioner = {
  resourceType: 'Practitioner',
  id: 'p-without-npi',
};

const practitionerWithOtherIdentifierOnly: Practitioner = {
  resourceType: 'Practitioner',
  id: 'p-other-id',
  identifier: [{ system: 'http://example.com/some-other-id', value: 'abc' }],
};

const practitionerWithEmptyNPIValue: Practitioner = {
  resourceType: 'Practitioner',
  id: 'p-empty-npi',
  identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '' }],
};

const expectNotAuthorized = (fn: () => unknown): void => {
  let thrown: unknown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toEqual(NOT_AUTHORIZED);
};

describe('assertPractitionerHasNPI', () => {
  it('passes when the practitioner has an NPI identifier', () => {
    expect(() => assertPractitionerHasNPI(practitionerWithNPI)).not.toThrow();
  });

  it('throws NOT_AUTHORIZED when there is no identifier at all', () => {
    expectNotAuthorized(() => assertPractitionerHasNPI(practitionerWithoutNPI));
  });

  it('throws NOT_AUTHORIZED when the only identifier is not an NPI', () => {
    expectNotAuthorized(() => assertPractitionerHasNPI(practitionerWithOtherIdentifierOnly));
  });

  it('throws NOT_AUTHORIZED when the NPI identifier has an empty value', () => {
    expectNotAuthorized(() => assertPractitionerHasNPI(practitionerWithEmptyNPIValue));
  });
});

describe('requirePractitionerNPI', () => {
  const makeOystehr = (practitioner: Practitioner): Oystehr =>
    ({ fhir: { get: async () => practitioner } }) as unknown as Oystehr;

  it('reads the practitioner and returns it when it has an NPI', async () => {
    const result = await requirePractitionerNPI(makeOystehr(practitionerWithNPI), 'p-with-npi');
    expect(result).toBe(practitionerWithNPI);
  });

  it('rejects with NOT_AUTHORIZED when the practitioner has no NPI', async () => {
    await expect(requirePractitionerNPI(makeOystehr(practitionerWithoutNPI), 'p-without-npi')).rejects.toEqual(
      NOT_AUTHORIZED
    );
  });
});
