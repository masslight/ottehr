/**
 * Unit tests for config-aware test utilities
 *
 * These tests validate that:
 * 1. createConfigForTest() creates proper config instances
 * 2. ConfigHelper methods derive correct expectations from config
 * 3. Different capability configs produce expected results
 */

import { createConfigForTest } from 'utils/lib/ottehr-config-test-fixtures';
import { describe, expect, it } from 'vitest';
import { ConfigHelper } from '../utils/config/ConfigHelper';

describe('createConfigForTest', () => {
  it('creates baseline config without modifications', () => {
    const config = createConfigForTest('baseline');

    expect(config).toBeDefined();
    expect(config.FormFields.contactInformation).toBeDefined();
    expect(config.FormFields.contactInformation.title).toBe('Contact information');
  });

  it('creates hiddenFields config with fields hidden', () => {
    const config = createConfigForTest('hiddenFields');

    expect(config).toBeDefined();
    expect(config.FormFields.contactInformation.hiddenFields).toBeDefined();
    expect(config.FormFields.contactInformation.hiddenFields?.length).toBeGreaterThan(0);
    // Verify specific fields are hidden
    expect(config.FormFields.contactInformation.hiddenFields).toContain('patient-street-address-2');
    expect(config.FormFields.contactInformation.hiddenFields).toContain('patient-preferred-communication-method');
  });

  it('creates customCopy config with modified titles', () => {
    const config = createConfigForTest('customCopy');

    expect(config).toBeDefined();
    expect(config.FormFields.contactInformation.title).toBeDefined();
    // Custom copy should have a different title than baseline
    const baselineConfig = createConfigForTest('baseline');
    expect(config.FormFields.contactInformation.title).not.toBe(baselineConfig.FormFields.contactInformation.title);
  });

  it('throws error for unknown capability config', () => {
    expect(() => createConfigForTest('nonexistent')).toThrow('Unknown capability config');
  });
});

describe('ConfigHelper.getPageTitle', () => {
  it('returns correct title for baseline config', () => {
    const config = createConfigForTest('baseline');
    const title = ConfigHelper.getPageTitle('contactInformation', config);

    expect(title).toBe('Contact information');
  });

  it('returns custom title for customCopy config', () => {
    const config = createConfigForTest('customCopy');
    const title = ConfigHelper.getPageTitle('contactInformation', config);

    expect(title).toBeDefined();
    expect(typeof title).toBe('string');
    expect(title.length).toBeGreaterThan(0);
  });

  it('returns same title for different config instances of same type', () => {
    const config1 = createConfigForTest('baseline');
    const config2 = createConfigForTest('baseline');

    const title1 = ConfigHelper.getPageTitle('contactInformation', config1);
    const title2 = ConfigHelper.getPageTitle('contactInformation', config2);

    expect(title1).toBe(title2);
  });
});

describe('ConfigHelper.getVisibleFields', () => {
  it('returns all fields for baseline config (no hidden fields)', () => {
    const config = createConfigForTest('baseline');
    const section = config.FormFields.contactInformation;
    const visibleFields = ConfigHelper.getVisibleFields(section);

    expect(visibleFields).toBeDefined();
    expect(Array.isArray(visibleFields)).toBe(true);
    expect(visibleFields.length).toBeGreaterThan(0);

    // All fields should have a key
    visibleFields.forEach((field) => {
      expect(field.key).toBeDefined();
      expect(typeof field.key).toBe('string');
    });
  });

  it('excludes hidden fields for hiddenFields config', () => {
    const config = createConfigForTest('hiddenFields');
    const section = config.FormFields.contactInformation;
    const visibleFields = ConfigHelper.getVisibleFields(section);
    const hiddenFields = section.hiddenFields || [];

    expect(visibleFields).toBeDefined();
    expect(hiddenFields.length).toBeGreaterThan(0);

    // No visible field should be in hiddenFields array
    visibleFields.forEach((field) => {
      expect(hiddenFields).not.toContain(field.key);
    });
  });

  it('returns fewer visible fields for hiddenFields config than baseline', () => {
    const baselineConfig = createConfigForTest('baseline');
    const hiddenFieldsConfig = createConfigForTest('hiddenFields');

    const baselineVisible = ConfigHelper.getVisibleFields(baselineConfig.FormFields.contactInformation);
    const hiddenFieldsVisible = ConfigHelper.getVisibleFields(hiddenFieldsConfig.FormFields.contactInformation);

    // Debug: check if hiddenFields was actually applied
    const hiddenFieldsArray = hiddenFieldsConfig.FormFields.contactInformation.hiddenFields || [];
    console.log('Hidden fields array:', hiddenFieldsArray);
    console.log('Baseline visible count:', baselineVisible.length);
    console.log('Hidden config visible count:', hiddenFieldsVisible.length);

    expect(hiddenFieldsVisible.length).toBeLessThan(baselineVisible.length);
  });
});

describe('ConfigHelper.getRequiredFields', () => {
  it('returns required fields array from config', () => {
    const config = createConfigForTest('baseline');
    const section = config.FormFields.contactInformation;
    const requiredFields = ConfigHelper.getRequiredFields(section);

    expect(Array.isArray(requiredFields)).toBe(true);
  });

  it('returns consistent required fields for same config type', () => {
    const config1 = createConfigForTest('baseline');
    const config2 = createConfigForTest('baseline');

    const required1 = ConfigHelper.getRequiredFields(config1.FormFields.contactInformation);
    const required2 = ConfigHelper.getRequiredFields(config2.FormFields.contactInformation);

    expect(required1).toEqual(required2);
  });
});

describe('ConfigHelper.isFieldHidden', () => {
  it('returns false for visible fields in baseline config', () => {
    const config = createConfigForTest('baseline');
    const section = config.FormFields.contactInformation;
    const visibleFields = ConfigHelper.getVisibleFields(section);

    if (visibleFields.length > 0) {
      const isHidden = ConfigHelper.isFieldHidden(visibleFields[0].key, section);
      expect(isHidden).toBe(false);
    }
  });

  it('returns true for hidden fields in hiddenFields config', () => {
    const config = createConfigForTest('hiddenFields');
    const section = config.FormFields.contactInformation;
    const hiddenFields = section.hiddenFields || [];

    if (hiddenFields.length > 0) {
      const isHidden = ConfigHelper.isFieldHidden(hiddenFields[0], section);
      expect(isHidden).toBe(true);
    }
  });

  it('same field has different visibility in different configs', () => {
    const baselineConfig = createConfigForTest('baseline');
    const hiddenFieldsConfig = createConfigForTest('hiddenFields');

    const hiddenFields = hiddenFieldsConfig.FormFields.contactInformation.hiddenFields || [];

    if (hiddenFields.length > 0) {
      const fieldKey = hiddenFields[0];

      const hiddenInBaseline = ConfigHelper.isFieldHidden(fieldKey, baselineConfig.FormFields.contactInformation);
      const hiddenInCustom = ConfigHelper.isFieldHidden(fieldKey, hiddenFieldsConfig.FormFields.contactInformation);

      expect(hiddenInBaseline).toBe(false);
      expect(hiddenInCustom).toBe(true);
    }
  });
});

describe('ConfigHelper.getAllFieldKeys', () => {
  it('returns all field keys from section', () => {
    const config = createConfigForTest('baseline');
    const section = config.FormFields.contactInformation;
    const allKeys = ConfigHelper.getAllFieldKeys(section);

    expect(Array.isArray(allKeys)).toBe(true);
    expect(allKeys.length).toBeGreaterThan(0);
  });

  it('returns same total fields across different configs', () => {
    const baselineConfig = createConfigForTest('baseline');
    const hiddenFieldsConfig = createConfigForTest('hiddenFields');

    const baselineKeys = ConfigHelper.getAllFieldKeys(baselineConfig.FormFields.contactInformation);
    const hiddenFieldsKeys = ConfigHelper.getAllFieldKeys(hiddenFieldsConfig.FormFields.contactInformation);

    // Total fields should be the same, only visibility differs
    expect(baselineKeys.length).toBe(hiddenFieldsKeys.length);
  });

  it('includes both visible and hidden fields', () => {
    const config = createConfigForTest('hiddenFields');
    const section = config.FormFields.contactInformation;

    const allKeys = ConfigHelper.getAllFieldKeys(section);
    const visibleFields = ConfigHelper.getVisibleFields(section);
    const hiddenFields = section.hiddenFields || [];

    expect(allKeys.length).toBe(visibleFields.length + hiddenFields.length);
  });
});

describe('Config isolation', () => {
  it('creates independent config instances', () => {
    const config1 = createConfigForTest('baseline');
    const config2 = createConfigForTest('baseline');

    // Should be separate instances
    expect(config1).not.toBe(config2);

    // But have equal content
    expect(config1.FormFields.contactInformation.title).toBe(config2.FormFields.contactInformation.title);
  });

  it('different capability configs have different properties', () => {
    const baseline = createConfigForTest('baseline');
    const hiddenFields = createConfigForTest('hiddenFields');
    const customCopy = createConfigForTest('customCopy');

    // Each config should be distinct
    expect(baseline.FormFields.contactInformation.hiddenFields?.length || 0).toBe(0);
    expect(hiddenFields.FormFields.contactInformation.hiddenFields?.length || 0).toBeGreaterThan(0);
    expect(customCopy.FormFields.contactInformation.title).not.toBe(baseline.FormFields.contactInformation.title);
  });
});
