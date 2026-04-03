import { describe, expect, it } from 'vitest';
import { validateExamConfig } from '../lib/config-helpers/examination';
// Examination config and validator
import { ExamConfig } from '../lib/ottehr-config/examination/index';
import { MEDICAL_HISTORY_CONFIG } from '../lib/ottehr-config/medical-history/index';
// Other configs
import { PROCEDURES_CONFIG } from '../lib/ottehr-config/procedures/index';
import { PROVIDER_CONFIG } from '../lib/ottehr-config/provider/index';
// Vitals config and Zod schema
import { DefaultVitalsConfig, VitalsConfigData, VitalsMap } from '../lib/ottehr-config/vitals/index';

describe('Vitals config validation', () => {
  it('default VitalsConfigData is not null or undefined', () => {
    expect(VitalsConfigData).toBeDefined();
    expect(VitalsConfigData).not.toBeNull();
  });

  it('has expected top-level vital keys', () => {
    expect(VitalsConfigData).toHaveProperty('vital-temperature');
    expect(VitalsConfigData).toHaveProperty('vital-heartbeat');
    expect(VitalsConfigData).toHaveProperty('vital-oxygen-sat');
    expect(VitalsConfigData).toHaveProperty('vital-blood-pressure');
    expect(VitalsConfigData).toHaveProperty('vital-weight');
    expect(VitalsConfigData).toHaveProperty('vital-height');
  });

  it('passes Zod VitalsMap.parse without throwing', () => {
    expect(() => VitalsMap.parse(VitalsConfigData)).not.toThrow();
  });

  it('DefaultVitalsConfig is frozen after Zod parse', () => {
    expect(Object.isFrozen(DefaultVitalsConfig)).toBe(true);
  });
});

describe('Examination config validation', () => {
  it('default ExamConfig is not null or undefined', () => {
    expect(ExamConfig).toBeDefined();
    expect(ExamConfig).not.toBeNull();
  });

  it('has expected top-level keys (telemed and inPerson)', () => {
    expect(ExamConfig).toHaveProperty('telemed');
    expect(ExamConfig).toHaveProperty('inPerson');
  });

  it('each exam type has a default variant with version and components', () => {
    expect(ExamConfig.telemed.default).toHaveProperty('version');
    expect(ExamConfig.telemed.default).toHaveProperty('components');
    expect(ExamConfig.inPerson.default).toHaveProperty('version');
    expect(ExamConfig.inPerson.default).toHaveProperty('components');
  });

  it('passes validateExamConfig without throwing', () => {
    expect(() => validateExamConfig(ExamConfig)).not.toThrow();
  });
});

describe('Procedures config validation', () => {
  it('default PROCEDURES_CONFIG is not null or undefined', () => {
    expect(PROCEDURES_CONFIG).toBeDefined();
    expect(PROCEDURES_CONFIG).not.toBeNull();
  });

  it('has expected top-level keys', () => {
    // These are proxy objects so we access properties directly rather than using toHaveProperty
    expect(PROCEDURES_CONFIG.quickPicks).toBeDefined();
    expect(PROCEDURES_CONFIG.prepopulation).toBeDefined();
  });

  it('quickPicks is an array with entries', () => {
    expect(Array.isArray(PROCEDURES_CONFIG.quickPicks)).toBe(true);
    expect(PROCEDURES_CONFIG.quickPicks.length).toBeGreaterThan(0);
  });
});

describe('Medical history config validation', () => {
  it('default MEDICAL_HISTORY_CONFIG is not null or undefined', () => {
    expect(MEDICAL_HISTORY_CONFIG).toBeDefined();
    expect(MEDICAL_HISTORY_CONFIG).not.toBeNull();
  });

  it('has expected top-level keys', () => {
    // These are proxy objects so we access properties directly rather than using toHaveProperty
    expect(MEDICAL_HISTORY_CONFIG.medicalConditions).toBeDefined();
    expect(MEDICAL_HISTORY_CONFIG.allergies).toBeDefined();
    expect(MEDICAL_HISTORY_CONFIG.medications).toBeDefined();
  });

  it('medicalConditions has quickPicks array', () => {
    expect(Array.isArray(MEDICAL_HISTORY_CONFIG.medicalConditions.quickPicks)).toBe(true);
    expect(MEDICAL_HISTORY_CONFIG.medicalConditions.quickPicks.length).toBeGreaterThan(0);
  });
});

describe('Provider config validation', () => {
  it('default PROVIDER_CONFIG is not null or undefined', () => {
    expect(PROVIDER_CONFIG).toBeDefined();
    expect(PROVIDER_CONFIG).not.toBeNull();
  });

  it('has expected top-level keys', () => {
    // This is a proxy object so we access properties directly rather than using toHaveProperty
    expect(PROVIDER_CONFIG.assessment).toBeDefined();
  });

  it('assessment has emCodeOptions array', () => {
    expect(Array.isArray(PROVIDER_CONFIG.assessment.emCodeOptions)).toBe(true);
    expect(PROVIDER_CONFIG.assessment.emCodeOptions.length).toBeGreaterThan(0);
  });
});
