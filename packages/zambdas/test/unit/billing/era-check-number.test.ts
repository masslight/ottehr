import { PaymentReconciliation } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { ERA_CHECK_SYSTEM, eraCheckNumberMatches, getEraCheckNumber } from '../../../src/billing/shared';

type EraCheckNumberFields = Pick<PaymentReconciliation, 'identifier' | 'paymentIdentifier'>;

// The Claim.MD converter stamps a searchable identifier
const claimMdEra = (checkNumber: string): EraCheckNumberFields => ({
  identifier: [
    {
      system: ERA_CHECK_SYSTEM,
      value: checkNumber,
    },
  ],
  paymentIdentifier: {
    system: ERA_CHECK_SYSTEM,
    value: checkNumber,
  },
});

// process-era sets paymentIdentifier only
const importedEra = (checkNumber: string): EraCheckNumberFields => ({
  paymentIdentifier: {
    system: ERA_CHECK_SYSTEM,
    value: checkNumber,
  },
});

describe('getEraCheckNumber', () => {
  it('reads the check number off the identifier when the converter stamped one', () => {
    expect(getEraCheckNumber(claimMdEra('CHK-100'))).toBe('CHK-100');
  });

  it('falls back to paymentIdentifier when there is no check number identifier', () => {
    expect(getEraCheckNumber(importedEra('CHK-100'))).toBe('CHK-100');
  });

  it('ignores identifiers in other systems', () => {
    const era: EraCheckNumberFields = {
      identifier: [
        {
          system: 'https://identifiers.fhir.oystehr.com/era-id',
          value: 'ERA-1',
        },
      ],
      paymentIdentifier: {
        system: ERA_CHECK_SYSTEM,
        value: 'CHK-100',
      },
    };
    expect(getEraCheckNumber(era)).toBe('CHK-100');
  });

  it('returns undefined when the ERA carries neither', () => {
    expect(getEraCheckNumber({})).toBeUndefined();
  });
});

describe('eraCheckNumberMatches', () => {
  it('matches an ERA whose check number is a searchable identifier', () => {
    expect(eraCheckNumberMatches(claimMdEra('CHK-100'), 'CHK-100')).toBe(true);
  });

  it('matches an ERA whose check number is only on paymentIdentifier', () => {
    expect(eraCheckNumberMatches(importedEra('CHK-100'), 'CHK-100')).toBe(true);
  });

  it('ignores surrounding whitespace on either side', () => {
    expect(eraCheckNumberMatches(importedEra('  CHK-100 '), 'CHK-100')).toBe(true);
    expect(eraCheckNumberMatches(importedEra('CHK-100'), ' CHK-100  ')).toBe(true);
  });

  it('matches a trace number regardless of case', () => {
    expect(eraCheckNumberMatches(importedEra('eft-abc123'), 'EFT-ABC123')).toBe(true);
  });

  it('rejects a different check number', () => {
    expect(eraCheckNumberMatches(importedEra('CHK-100'), 'CHK-101')).toBe(false);
  });

  it('rejects a check number that is only a prefix of the stored one', () => {
    expect(eraCheckNumberMatches(importedEra('CHK-1000'), 'CHK-100')).toBe(false);
  });

  it('rejects an ERA with no check number at all', () => {
    expect(eraCheckNumberMatches({}, 'CHK-100')).toBe(false);
  });

  it('rejects an ERA whose stored check number is blank', () => {
    expect(
      eraCheckNumberMatches(
        {
          paymentIdentifier: {
            system: ERA_CHECK_SYSTEM,
            value: '   ',
          },
        },
        'CHK-100'
      )
    ).toBe(false);
  });
});
