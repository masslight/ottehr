/**
 * Tests for procedures configuration variations via window injection.
 *
 * Verifies that the PROCEDURES_CONFIG proxy object correctly handles:
 * - Default config shape (quickPicks, prepopulation)
 * - Override with empty quickPicks
 * - Override with custom quickPick entries (full and minimal)
 * - Override with custom prepopulation mapping
 * - Frozen config (immutability)
 */
import { PROCEDURES_CONFIG } from 'utils';
import { CONFIG_INJECTION_KEYS } from 'utils/lib/config-helpers/helpers';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  delete (window as any)[CONFIG_INJECTION_KEYS.PROCEDURES];
});

describe('Procedures config - default values', () => {
  it('has quickPicks array with entries', () => {
    expect(Array.isArray(PROCEDURES_CONFIG.quickPicks)).toBe(true);
    expect(PROCEDURES_CONFIG.quickPicks.length).toBeGreaterThan(0);
  });

  it('has prepopulation object', () => {
    expect(PROCEDURES_CONFIG.prepopulation).toBeDefined();
    expect(typeof PROCEDURES_CONFIG.prepopulation).toBe('object');
  });
});

describe('Procedures config - quickPicks overrides', () => {
  it('override with empty quickPicks array', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PROCEDURES] = {
      quickPicks: [],
    };

    expect(PROCEDURES_CONFIG.quickPicks).toEqual([]);
    expect(PROCEDURES_CONFIG.quickPicks.length).toBe(0);
  });

  it('override with custom quickPick entry containing all optional fields', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PROCEDURES] = {
      quickPicks: [
        {
          name: 'Custom Procedure',
          procedureType: 'custom-type',
          cptCodes: [
            {
              code: '99999',
              display: 'Custom CPT code',
            },
          ],
          postInstructions: ['Follow up in 2 weeks', 'Apply ice as needed'],
          bodySide: 'Left',
          technique: ['Sterile', 'Aseptic'],
          suppliesUsed: ['Suture Kit', 'Gauze'],
        },
      ],
    };

    expect(PROCEDURES_CONFIG.quickPicks.length).toBe(1);

    const entry = PROCEDURES_CONFIG.quickPicks[0];
    expect(entry.name).toBe('Custom Procedure');
    expect(entry.procedureType).toBe('custom-type');
    expect(entry.cptCodes).toEqual([{ code: '99999', display: 'Custom CPT code' }]);
    expect(entry.postInstructions).toEqual(['Follow up in 2 weeks', 'Apply ice as needed']);
    expect(entry.bodySide).toBe('Left');
    expect(entry.technique).toEqual(['Sterile', 'Aseptic']);
    expect(entry.suppliesUsed).toEqual(['Suture Kit', 'Gauze']);
  });

  it('override with minimal quickPick entry (only required fields)', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PROCEDURES] = {
      quickPicks: [
        {
          name: 'Minimal Procedure',
        },
      ],
    };

    expect(PROCEDURES_CONFIG.quickPicks.length).toBe(1);

    const entry = PROCEDURES_CONFIG.quickPicks[0];
    expect(entry.name).toBe('Minimal Procedure');
    expect(entry.cptCodes).toBeUndefined();
    expect(entry.postInstructions).toBeUndefined();
    expect(entry.bodySide).toBeUndefined();
    expect(entry.technique).toBeUndefined();
    expect(entry.suppliesUsed).toBeUndefined();
  });
});

describe('Procedures config - prepopulation overrides', () => {
  it('override with custom prepopulation mapping', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PROCEDURES] = {
      prepopulation: {
        'laceration-repair': {
          complications: 'None',
          patientResponse: 'Tolerated Well',
          consentObtained: true,
        },
        'x-ray': {
          complications: 'None',
          postInstructions: ['Follow up as needed'],
        },
      },
    };

    expect(PROCEDURES_CONFIG.prepopulation).toBeDefined();
    expect(PROCEDURES_CONFIG.prepopulation['laceration-repair']).toEqual({
      complications: 'None',
      patientResponse: 'Tolerated Well',
      consentObtained: true,
    });
    expect(PROCEDURES_CONFIG.prepopulation['x-ray']).toEqual({
      complications: 'None',
      postInstructions: ['Follow up as needed'],
    });
  });
});

describe('Procedures config - immutability', () => {
  it('overridden config is frozen and mutation throws', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PROCEDURES] = {
      quickPicks: [{ name: 'Frozen Entry' }],
    };

    expect(() => {
      (PROCEDURES_CONFIG.quickPicks as any).push({ name: 'Should fail' });
    }).toThrow();
  });

  it('overridden config nested properties are frozen', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PROCEDURES] = {
      quickPicks: [{ name: 'Frozen Entry', technique: ['Aseptic'] }],
    };

    const entry = PROCEDURES_CONFIG.quickPicks[0];
    expect(() => {
      (entry as any).name = 'Modified';
    }).toThrow();
  });
});
