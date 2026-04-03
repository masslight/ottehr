/**
 * Tests for medical history configuration variations.
 *
 * Verifies that the MEDICAL_HISTORY_CONFIG proxy object correctly handles
 * different config shapes via window injection:
 * - Default quick picks for medical conditions, allergies, and medications
 * - Overriding with empty quick picks
 * - Overriding with custom quick picks
 * - Frozen config (immutability)
 */
import { CONFIG_INJECTION_KEYS, MEDICAL_HISTORY_CONFIG } from 'utils';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  delete (window as any)[CONFIG_INJECTION_KEYS.MEDICAL_HISTORY];
});

describe('Medical history config - default quick picks', () => {
  it('default config has medicalConditions.quickPicks array with entries', () => {
    const quickPicks = MEDICAL_HISTORY_CONFIG.medicalConditions.quickPicks;
    expect(Array.isArray(quickPicks)).toBe(true);
    expect(quickPicks.length).toBeGreaterThan(0);
    expect(quickPicks[0]).toHaveProperty('display');
  });

  it('default config has allergies.quickPicks array with entries', () => {
    const quickPicks = MEDICAL_HISTORY_CONFIG.allergies.quickPicks;
    expect(Array.isArray(quickPicks)).toBe(true);
    expect(quickPicks.length).toBeGreaterThan(0);
    expect(quickPicks[0]).toHaveProperty('name');
  });

  it('default config has medications.quickPicks array with entries', () => {
    const quickPicks = MEDICAL_HISTORY_CONFIG.medications.quickPicks;
    expect(Array.isArray(quickPicks)).toBe(true);
    expect(quickPicks.length).toBeGreaterThan(0);
    expect(quickPicks[0]).toHaveProperty('name');
    expect(quickPicks[0]).toHaveProperty('id');
  });
});

describe('Medical history config - override with empty quickPicks', () => {
  it('override with empty quickPicks for medicalConditions', () => {
    (window as any)[CONFIG_INJECTION_KEYS.MEDICAL_HISTORY] = {
      medicalConditions: {
        quickPicks: [],
      },
    };

    const quickPicks = MEDICAL_HISTORY_CONFIG.medicalConditions.quickPicks;
    expect(Array.isArray(quickPicks)).toBe(true);
    expect(quickPicks.length).toBe(0);
  });
});

describe('Medical history config - override with custom quickPicks', () => {
  it('override with custom medicalConditions quickPick (with label, code, ICD-10)', () => {
    (window as any)[CONFIG_INJECTION_KEYS.MEDICAL_HISTORY] = {
      medicalConditions: {
        quickPicks: [{ display: 'Custom Condition', code: 'Z99.0' }],
      },
    };

    const quickPicks = MEDICAL_HISTORY_CONFIG.medicalConditions.quickPicks;
    expect(quickPicks).toHaveLength(1);
    expect(quickPicks[0].display).toBe('Custom Condition');
    expect(quickPicks[0].code).toBe('Z99.0');
  });

  it('override with custom allergies quickPick', () => {
    (window as any)[CONFIG_INJECTION_KEYS.MEDICAL_HISTORY] = {
      allergies: {
        quickPicks: [{ name: 'Custom Allergy', id: 9999 }],
      },
    };

    const quickPicks = MEDICAL_HISTORY_CONFIG.allergies.quickPicks;
    expect(quickPicks).toHaveLength(1);
    expect(quickPicks[0].name).toBe('Custom Allergy');
    expect(quickPicks[0].id).toBe(9999);
  });

  it('override with custom medications quickPick (with strength)', () => {
    (window as any)[CONFIG_INJECTION_KEYS.MEDICAL_HISTORY] = {
      medications: {
        quickPicks: [{ name: 'Custom Med', strength: '100 mg', id: 55555 }],
      },
    };

    const quickPicks = MEDICAL_HISTORY_CONFIG.medications.quickPicks;
    expect(quickPicks).toHaveLength(1);
    expect(quickPicks[0].name).toBe('Custom Med');
    expect(quickPicks[0].strength).toBe('100 mg');
    expect(quickPicks[0].id).toBe(55555);
  });
});

describe('Medical history config - immutability', () => {
  it('config is frozen (mutation throws)', () => {
    // Inject an override so the config goes through mergeAndFreezeConfigObjects,
    // which deep-freezes the entire result including nested arrays.
    (window as any)[CONFIG_INJECTION_KEYS.MEDICAL_HISTORY] = {
      medicalConditions: {
        quickPicks: [{ display: 'Frozen Entry', code: 'F00.0' }],
      },
    };

    const quickPicks = MEDICAL_HISTORY_CONFIG.medicalConditions.quickPicks;

    expect(() => {
      (quickPicks as any).push({ display: 'Should fail' });
    }).toThrow();

    expect(() => {
      (quickPicks as any)[0] = { display: 'Should also fail' };
    }).toThrow();
  });
});
