/**
 * Tests for provider configuration variations.
 *
 * Verifies that the PROVIDER_CONFIG proxy correctly handles:
 * - Default EM code options
 * - Default visionAutoCptCodes
 * - Window-injected overrides for custom EM codes
 * - Window-injected overrides for visionAutoCptCodes
 * - Frozen (immutable) config objects
 */
import { CONFIG_INJECTION_KEYS, PROVIDER_CONFIG } from 'utils';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  delete (window as any)[CONFIG_INJECTION_KEYS.PROVIDER];
});

describe('Provider config - default values', () => {
  it('has assessment.emCodeOptions array with entries', () => {
    const options = PROVIDER_CONFIG.assessment.emCodeOptions;
    expect(Array.isArray(options)).toBe(true);
    expect(options.length).toBeGreaterThan(0);
    // Each entry should have code and display
    for (const option of options) {
      expect(option).toHaveProperty('code');
      expect(option).toHaveProperty('display');
      expect(typeof option.code).toBe('string');
      expect(typeof option.display).toBe('string');
    }
  });

  it('has visionAutoCptCodes with default value', () => {
    const codes = PROVIDER_CONFIG.assessment.visionAutoCptCodes;
    expect(Array.isArray(codes)).toBe(true);
    expect(codes!.length).toBeGreaterThan(0);
    expect(codes).toContain('99173');
  });
});

describe('Provider config - EM code overrides', () => {
  it('overrides with custom EM codes', () => {
    const customCodes = [
      { display: 'Custom Code A', code: 'A0001' },
      { display: 'Custom Code B', code: 'B0002' },
      { display: 'Custom Code C', code: 'C0003' },
    ];
    (window as any)[CONFIG_INJECTION_KEYS.PROVIDER] = {
      assessment: { emCodeOptions: customCodes },
    };

    const options = PROVIDER_CONFIG.assessment.emCodeOptions;
    expect(options).toHaveLength(3);
    expect(options[0].code).toBe('A0001');
    expect(options[1].code).toBe('B0002');
    expect(options[2].code).toBe('C0003');
  });

  it('overrides with a single EM code', () => {
    const singleCode = [{ display: 'Only Code', code: '99999' }];
    (window as any)[CONFIG_INJECTION_KEYS.PROVIDER] = {
      assessment: { emCodeOptions: singleCode },
    };

    const options = PROVIDER_CONFIG.assessment.emCodeOptions;
    expect(options).toHaveLength(1);
    expect(options[0].code).toBe('99999');
    expect(options[0].display).toBe('Only Code');
  });
});

describe('Provider config - visionAutoCptCodes overrides', () => {
  it('overrides with empty visionAutoCptCodes array', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PROVIDER] = {
      assessment: { visionAutoCptCodes: [] },
    };

    const codes = PROVIDER_CONFIG.assessment.visionAutoCptCodes;
    expect(Array.isArray(codes)).toBe(true);
    expect(codes).toHaveLength(0);
  });

  it('overrides with custom visionAutoCptCodes', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PROVIDER] = {
      assessment: { visionAutoCptCodes: ['12345', '67890'] },
    };

    const codes = PROVIDER_CONFIG.assessment.visionAutoCptCodes;
    expect(codes).toEqual(['12345', '67890']);
  });
});

describe('Provider config - immutability', () => {
  it('config is frozen when overrides are applied and mutation throws', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PROVIDER] = {
      assessment: { visionAutoCptCodes: ['11111'] },
    };

    const assessment = PROVIDER_CONFIG.assessment;
    expect(Object.isFrozen(assessment)).toBe(true);
    expect(() => {
      (assessment as any).emCodeOptions = [];
    }).toThrow();
  });
});
