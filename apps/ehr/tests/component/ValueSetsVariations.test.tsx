/**
 * Tests for value-sets configuration variations.
 *
 * Verifies that the VALUE_SETS proxy object correctly handles
 * different config shapes via window injection:
 * - Default option arrays for visit reasons, cancellation reasons, insurance types
 * - Overriding with custom reasonForVisitOptions
 * - Overriding with minimal reasonForVisitOptions
 * - Overriding with specialty visit type options (OccMed, WorkersComp, PreOp)
 * - Frozen config (immutability)
 */
import { CONFIG_INJECTION_KEYS, VALUE_SETS } from 'utils';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  delete (window as any)[CONFIG_INJECTION_KEYS.VALUE_SETS];
});

describe('Value sets config - default reasonForVisitOptions', () => {
  it('default config has reasonForVisitOptions array with entries', () => {
    const options = VALUE_SETS.reasonForVisitOptions;
    expect(Array.isArray(options)).toBe(true);
    expect(options.length).toBeGreaterThan(0);
    expect(options[0]).toHaveProperty('label');
    expect(options[0]).toHaveProperty('value');
  });
});

describe('Value sets config - default cancelReasonOptionsInPersonProvider', () => {
  it('default config has cancelReasonOptionsInPersonProvider array with entries', () => {
    const options = VALUE_SETS.cancelReasonOptionsInPersonProvider;
    expect(Array.isArray(options)).toBe(true);
    expect(options.length).toBeGreaterThan(0);
    expect(options[0]).toHaveProperty('label');
    expect(options[0]).toHaveProperty('value');
  });
});

describe('Value sets config - default cancelReasonOptionsVirtualProvider', () => {
  it('default config has cancelReasonOptionsVirtualProvider array with entries', () => {
    const options = VALUE_SETS.cancelReasonOptionsVirtualProvider;
    expect(Array.isArray(options)).toBe(true);
    expect(options.length).toBeGreaterThan(0);
    expect(options[0]).toHaveProperty('label');
    expect(options[0]).toHaveProperty('value');
  });
});

describe('Value sets config - default insuranceTypeOptions', () => {
  it('default config has insuranceTypeOptions array with entries', () => {
    const options = VALUE_SETS.insuranceTypeOptions;
    expect(Array.isArray(options)).toBe(true);
    expect(options.length).toBeGreaterThan(0);
    expect(options[0]).toHaveProperty('candidCode');
    expect(options[0]).toHaveProperty('label');
  });
});

describe('Value sets config - override with custom reasonForVisitOptions', () => {
  it('override replaces reasonForVisitOptions entirely', () => {
    (window as any)[CONFIG_INJECTION_KEYS.VALUE_SETS] = {
      reasonForVisitOptions: [
        { label: 'Custom Reason A', value: 'Custom Reason A' },
        { label: 'Custom Reason B', value: 'Custom Reason B' },
        { label: 'Custom Reason C', value: 'Custom Reason C' },
        { label: 'Other', value: 'Other' },
      ],
    };

    const options = VALUE_SETS.reasonForVisitOptions;
    expect(options).toHaveLength(4);
    expect(options[0].label).toBe('Custom Reason A');
    expect(options[3].label).toBe('Other');
  });
});

describe('Value sets config - override with minimal reasonForVisitOptions', () => {
  it('override with only 2 options', () => {
    (window as any)[CONFIG_INJECTION_KEYS.VALUE_SETS] = {
      reasonForVisitOptions: [
        { label: 'Sick Visit', value: 'Sick Visit' },
        { label: 'Other', value: 'Other' },
      ],
    };

    const options = VALUE_SETS.reasonForVisitOptions;
    expect(options).toHaveLength(2);
    expect(options[0].label).toBe('Sick Visit');
    expect(options[1].label).toBe('Other');
  });
});

describe('Value sets config - override adding reasonForVisitOptionsOccMed', () => {
  it('override replaces reasonForVisitOptionsOccMed', () => {
    (window as any)[CONFIG_INJECTION_KEYS.VALUE_SETS] = {
      reasonForVisitOptionsOccMed: [
        { label: 'Drug Screen', value: 'Drug Screen' },
        { label: 'DOT Physical', value: 'DOT Physical' },
        { label: 'Injury', value: 'Injury' },
      ],
    };

    const options = VALUE_SETS.reasonForVisitOptionsOccMed;
    expect(options).toHaveLength(3);
    expect(options[0].label).toBe('Drug Screen');
    expect(options[1].label).toBe('DOT Physical');
    expect(options[2].label).toBe('Injury');
  });
});

describe('Value sets config - override adding reasonForVisitOptionsWorkersComp', () => {
  it('override replaces reasonForVisitOptionsWorkersComp', () => {
    (window as any)[CONFIG_INJECTION_KEYS.VALUE_SETS] = {
      reasonForVisitOptionsWorkersComp: [
        { label: 'Initial evaluation', value: 'Initial evaluation' },
        { label: 'Follow-up', value: 'Follow-up' },
        { label: 'Return to work', value: 'Return to work' },
      ],
    };

    const options = VALUE_SETS.reasonForVisitOptionsWorkersComp;
    expect(options).toHaveLength(3);
    expect(options[0].label).toBe('Initial evaluation');
    expect(options[2].label).toBe('Return to work');
  });
});

describe('Value sets config - override adding reasonForVisitOptionsPreOp', () => {
  it('override sets reasonForVisitOptionsPreOp (optional field)', () => {
    (window as any)[CONFIG_INJECTION_KEYS.VALUE_SETS] = {
      reasonForVisitOptionsPreOp: [
        { label: 'Pre-op clearance', value: 'Pre-op clearance' },
        { label: 'Pre-op labs', value: 'Pre-op labs' },
      ],
    };

    const options = VALUE_SETS.reasonForVisitOptionsPreOp;
    expect(options).toHaveLength(2);
    expect(options![0].label).toBe('Pre-op clearance');
    expect(options![1].label).toBe('Pre-op labs');
  });
});

describe('Value sets config - immutability', () => {
  it('config is frozen (mutation throws)', () => {
    const options = VALUE_SETS.reasonForVisitOptions;

    expect(() => {
      (options as any).push({ label: 'Should fail', value: 'Should fail' });
    }).toThrow();

    expect(() => {
      (options as any)[0] = { label: 'Should also fail', value: 'Should also fail' };
    }).toThrow();
  });
});
