/**
 * Tests for vitals configuration variations.
 *
 * Verifies that vitals components correctly handle different config variations:
 * - Weight unit (kg vs lbs)
 * - Alert threshold evaluation (age-based, criticality levels)
 * - Missing vital types
 */
import { VitalAlertCriticality } from 'utils';
// Test the vitals alert evaluation logic directly, since it's the core
// config-driven behavior. The UI components render based on these results.
import { VitalsConfigData, VitalsDef } from 'utils';
import { describe, expect, it } from 'vitest';

describe('Vitals config - weight unit variations', () => {
  it('defaults weight unit to kg when not specified', () => {
    const config = VitalsDef({
      'vital-weight': {
        alertThresholds: [],
      },
    });
    expect(config['vital-weight']?.unit).toBe('kg');
  });

  it('accepts lbs as weight unit', () => {
    const config = VitalsDef({
      'vital-weight': {
        unit: 'lbs',
        alertThresholds: [],
      },
    });
    expect(config['vital-weight']?.unit).toBe('lbs');
  });

  it('accepts kg as explicit weight unit', () => {
    const config = VitalsDef({
      'vital-weight': {
        unit: 'kg',
        alertThresholds: [],
      },
    });
    expect(config['vital-weight']?.unit).toBe('kg');
  });
});

describe('Vitals config - vital types present/absent', () => {
  it('accepts config with all vital types', () => {
    expect(() => VitalsDef(VitalsConfigData)).not.toThrow();
    const config = VitalsDef(VitalsConfigData);
    expect(config['vital-temperature']).toBeDefined();
    expect(config['vital-heartbeat']).toBeDefined();
    expect(config['vital-oxygen-sat']).toBeDefined();
    expect(config['vital-respiration-rate']).toBeDefined();
    expect(config['vital-weight']).toBeDefined();
    expect(config['vital-height']).toBeDefined();
    expect(config['vital-blood-pressure']).toBeDefined();
  });

  it('accepts config with only temperature and weight (minimal)', () => {
    const config = VitalsDef({
      'vital-temperature': {
        alertThresholds: [
          {
            rules: [
              { type: 'min', units: 'celsius', value: 36 },
              { type: 'max', units: 'celsius', value: 38 },
            ],
          },
        ],
      },
      'vital-weight': {
        unit: 'kg',
        alertThresholds: [],
      },
    });
    expect(config['vital-temperature']).toBeDefined();
    expect(config['vital-weight']).toBeDefined();
    // Other vitals should have defaults
  });

  it('accepts empty config (no vitals configured)', () => {
    const config = VitalsDef({});
    // weight has a default
    expect(config['vital-weight']?.unit).toBe('kg');
  });
});

describe('Vitals config - alert threshold variations', () => {
  it('accepts single age bracket', () => {
    const config = VitalsDef({
      'vital-temperature': {
        alertThresholds: [
          {
            rules: [
              { type: 'min', units: 'celsius', value: 36 },
              { type: 'max', units: 'celsius', value: 38 },
            ],
          },
        ],
      },
    });
    expect(config['vital-temperature']?.alertThresholds?.length).toBe(1);
  });

  it('accepts multiple age brackets', () => {
    const config = VitalsDef({
      'vital-temperature': {
        alertThresholds: [
          {
            rules: [
              { type: 'min', units: 'celsius', value: 36.5 },
              { type: 'max', units: 'celsius', value: 37.9 },
            ],
            minAge: { unit: 'months', value: 0 },
            maxAge: { unit: 'months', value: 12 },
          },
          {
            rules: [
              { type: 'min', units: 'celsius', value: 36 },
              { type: 'max', units: 'celsius', value: 37.9 },
            ],
            minAge: { unit: 'months', value: 12 },
          },
        ],
      },
    });
    expect(config['vital-temperature']?.alertThresholds?.length).toBe(2);
  });

  it('accepts threshold with criticality levels', () => {
    const config = VitalsDef({
      'vital-heartbeat': {
        alertThresholds: [
          {
            rules: [
              { type: 'min', units: 'bpm', value: 40, criticality: VitalAlertCriticality.Critical },
              { type: 'max', units: 'bpm', value: 200, criticality: VitalAlertCriticality.Critical },
            ],
          },
        ],
      },
    });
    const rules = config['vital-heartbeat']?.alertThresholds?.[0]?.rules;
    expect(rules?.[0]?.criticality).toBe(VitalAlertCriticality.Critical);
  });

  it('defaults criticality to Abnormal when not specified', () => {
    const config = VitalsDef({
      'vital-heartbeat': {
        alertThresholds: [
          {
            rules: [
              { type: 'min', units: 'bpm', value: 60 },
              { type: 'max', units: 'bpm', value: 100 },
            ],
          },
        ],
      },
    });
    const rules = config['vital-heartbeat']?.alertThresholds?.[0]?.rules;
    expect(rules?.[0]?.criticality).toBe(VitalAlertCriticality.Abnormal);
  });

  it('accepts threshold with only min rule (no max)', () => {
    const config = VitalsDef({
      'vital-oxygen-sat': {
        alertThresholds: [
          {
            rules: [{ type: 'min', units: '', value: 94 }],
          },
        ],
      },
    });
    expect(config['vital-oxygen-sat']?.alertThresholds?.[0]?.rules?.length).toBe(1);
  });

  it('accepts threshold with only max rule (no min)', () => {
    const config = VitalsDef({
      'vital-oxygen-sat': {
        alertThresholds: [
          {
            rules: [{ type: 'max', units: '', value: 100 }],
          },
        ],
      },
    });
    expect(config['vital-oxygen-sat']?.alertThresholds?.[0]?.rules?.length).toBe(1);
  });

  it('accepts open-ended age bracket (no maxAge)', () => {
    const config = VitalsDef({
      'vital-heartbeat': {
        alertThresholds: [
          {
            rules: [
              { type: 'min', units: 'bpm', value: 57 },
              { type: 'max', units: 'bpm', value: 115 },
            ],
            minAge: { unit: 'months', value: 180 },
            // no maxAge — applies to all ages >= 180 months
          },
        ],
      },
    });
    const threshold = config['vital-heartbeat']?.alertThresholds?.[0];
    expect(threshold?.minAge).toBeDefined();
    expect(threshold?.maxAge).toBeUndefined();
  });
});

describe('Vitals config - blood pressure component variations', () => {
  it('accepts blood pressure with systolic only', () => {
    const config = VitalsDef({
      'vital-blood-pressure': {
        components: {
          'systolic-pressure': {
            alertThresholds: [{ rules: [{ type: 'max', units: '', value: 140 }] }],
          },
        },
      },
    });
    expect(config['vital-blood-pressure']?.components?.['systolic-pressure']).toBeDefined();
  });

  it('accepts blood pressure with different threshold values per customer', () => {
    const config = VitalsDef({
      'vital-blood-pressure': {
        components: {
          'systolic-pressure': {
            alertThresholds: [
              { rules: [{ type: 'max', units: '', value: 130 }] }, // stricter than default 140
            ],
          },
        },
      },
    });
    const systolicMax =
      config['vital-blood-pressure']?.components?.['systolic-pressure']?.alertThresholds?.[0]?.rules?.[0];
    expect(systolicMax?.value).toBe(130);
  });

  it('rejects blood pressure with top-level alertThresholds (must use components)', () => {
    expect(() =>
      VitalsDef({
        'vital-blood-pressure': {
          alertThresholds: [{ rules: [{ type: 'max', units: '', value: 140 }] }],
          components: {
            'systolic-pressure': { alertThresholds: [] },
          },
        },
      })
    ).toThrow();
  });
});

describe('Vitals config - validation rejects invalid configs', () => {
  it('rejects conflicting min/max rules (min > max)', () => {
    expect(() =>
      VitalsDef({
        'vital-temperature': {
          alertThresholds: [
            {
              rules: [
                { type: 'min', units: 'celsius', value: 40 },
                { type: 'max', units: 'celsius', value: 35 }, // max < min
              ],
            },
          ],
        },
      })
    ).toThrow();
  });

  it('rejects age range where minAge > maxAge', () => {
    expect(() =>
      VitalsDef({
        'vital-temperature': {
          alertThresholds: [
            {
              rules: [
                { type: 'min', units: 'celsius', value: 36 },
                { type: 'max', units: 'celsius', value: 38 },
              ],
              minAge: { unit: 'months', value: 24 },
              maxAge: { unit: 'months', value: 12 }, // maxAge < minAge
            },
          ],
        },
      })
    ).toThrow();
  });
});
