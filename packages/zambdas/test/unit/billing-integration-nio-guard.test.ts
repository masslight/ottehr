import { Secrets } from 'utils/lib/secrets';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// FEATURE_FLAGS_CONFIG is a frozen compile-time constant, so tests toggle it through a
// hoisted mutable object standing in for the module.
const flags = vi.hoisted(() => ({ nonInsuranceOrganizationsEnabled: false }));
vi.mock('utils/lib/ottehr-config/feature-flags', () => ({ FEATURE_FLAGS_CONFIG: flags }));

import { shouldUseCandid, shouldUseOttehrBilling } from '../../src/shared/candid';

const secretsWith = (billingIntegration?: string): Secrets =>
  ({ BILLING_INTEGRATION: billingIntegration }) as unknown as Secrets;

describe('shouldUseCandid NIO guard', () => {
  beforeEach(() => {
    flags.nonInsuranceOrganizationsEnabled = false;
  });

  describe('with non-insurance organizations off (legacy truth table)', () => {
    it.each([
      ['candid', true],
      ['all', true],
      ['ottehr', false],
    ])('BILLING_INTEGRATION=%s → %s', (value, expected) => {
      expect(shouldUseCandid(secretsWith(value))).toBe(expected);
    });

    it('defaults unset BILLING_INTEGRATION to Candid', () => {
      expect(shouldUseCandid(secretsWith(undefined))).toBe(true);
      expect(shouldUseCandid(secretsWith(''))).toBe(true);
    });
  });

  describe('with non-insurance organizations on', () => {
    beforeEach(() => {
      flags.nonInsuranceOrganizationsEnabled = true;
    });

    it('returns false for BILLING_INTEGRATION=ottehr', () => {
      expect(shouldUseCandid(secretsWith('ottehr'))).toBe(false);
    });

    it.each(['candid', 'all'])('throws for BILLING_INTEGRATION=%s', (value) => {
      expect(() => shouldUseCandid(secretsWith(value))).toThrow(
        'Candid claims are not supported with non-insurance organizations'
      );
    });

    it('throws for unset BILLING_INTEGRATION, naming the unset value', () => {
      expect(() => shouldUseCandid(secretsWith(undefined))).toThrow("BILLING_INTEGRATION is '(unset)'");
    });
  });
});

describe('shouldUseOttehrBilling', () => {
  it('is untouched by the NIO flag', () => {
    for (const nio of [false, true]) {
      flags.nonInsuranceOrganizationsEnabled = nio;
      expect(shouldUseOttehrBilling(secretsWith('ottehr'))).toBe(true);
      expect(shouldUseOttehrBilling(secretsWith('all'))).toBe(true);
      expect(shouldUseOttehrBilling(secretsWith('candid'))).toBe(false);
      expect(shouldUseOttehrBilling(secretsWith(undefined))).toBe(false);
    }
  });
});
