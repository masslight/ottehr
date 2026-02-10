/**
 * Unit tests for booking config-aware test utilities
 *
 * These tests validate that:
 * 1. createBookingConfigForTest() creates proper config instances
 * 2. BookingConfigHelper methods derive correct expectations from config
 * 3. Different capability configs produce expected booking flow results
 */

import { createBookingConfigForTest } from 'utils/lib/ottehr-config-test-fixtures';
import { describe, expect, it } from 'vitest';
import { BookingConfigHelper } from '../utils/config/BookingConfigHelper';

describe('createBookingConfigForTest', () => {
  it('creates baseline config with all flows enabled', () => {
    const config = createBookingConfigForTest('baseline');

    expect(config).toBeDefined();
    expect(config.serviceCategoriesEnabled).toBeDefined();
    expect(config.homepageOptions).toBeDefined();
    expect(config.serviceCategories).toBeDefined();
  });

  it('creates inPersonOnly config with only in-person mode', () => {
    const config = createBookingConfigForTest('inPersonOnly');

    expect(config).toBeDefined();
    expect(config.serviceCategoriesEnabled.serviceModes).toEqual(['in-person']);
    expect(config.serviceCategoriesEnabled.serviceModes).not.toContain('virtual');
  });

  it('creates virtualOnly config with only virtual mode', () => {
    const config = createBookingConfigForTest('virtualOnly');

    expect(config).toBeDefined();
    expect(config.serviceCategoriesEnabled.serviceModes).toEqual(['virtual']);
    expect(config.serviceCategoriesEnabled.serviceModes).not.toContain('in-person');
  });

  it('creates prebookOnly config with only prebook visit type', () => {
    const config = createBookingConfigForTest('prebookOnly');

    expect(config).toBeDefined();
    expect(config.serviceCategoriesEnabled.visitType).toEqual(['prebook']);
    expect(config.serviceCategoriesEnabled.visitType).not.toContain('walk-in');
  });

  it('creates walkInOnly config with only walk-in visit type', () => {
    const config = createBookingConfigForTest('walkInOnly');

    expect(config).toBeDefined();
    expect(config.serviceCategoriesEnabled.visitType).toEqual(['walk-in']);
    expect(config.serviceCategoriesEnabled.visitType).not.toContain('prebook');
  });

  it('throws error for unknown capability config', () => {
    expect(() => createBookingConfigForTest('nonexistent')).toThrow('Unknown booking capability config');
  });
});

describe('BookingConfigHelper.getEnabledServiceModes', () => {
  it('returns all service modes for baseline config', () => {
    const config = createBookingConfigForTest('baseline');
    const modes = BookingConfigHelper.getEnabledServiceModes(config);

    expect(modes).toContain('in-person');
    expect(modes).toContain('virtual');
  });

  it('returns only in-person for inPersonOnly config', () => {
    const config = createBookingConfigForTest('inPersonOnly');
    const modes = BookingConfigHelper.getEnabledServiceModes(config);

    expect(modes).toEqual(['in-person']);
    expect(modes.length).toBe(1);
  });

  it('returns only virtual for virtualOnly config', () => {
    const config = createBookingConfigForTest('virtualOnly');
    const modes = BookingConfigHelper.getEnabledServiceModes(config);

    expect(modes).toEqual(['virtual']);
    expect(modes.length).toBe(1);
  });
});

describe('BookingConfigHelper.getEnabledVisitTypes', () => {
  it('returns all visit types for baseline config', () => {
    const config = createBookingConfigForTest('baseline');
    const types = BookingConfigHelper.getEnabledVisitTypes(config);

    expect(types).toContain('prebook');
    expect(types).toContain('walk-in');
  });

  it('returns only prebook for prebookOnly config', () => {
    const config = createBookingConfigForTest('prebookOnly');
    const types = BookingConfigHelper.getEnabledVisitTypes(config);

    expect(types).toEqual(['prebook']);
  });

  it('returns only walk-in for walkInOnly config', () => {
    const config = createBookingConfigForTest('walkInOnly');
    const types = BookingConfigHelper.getEnabledVisitTypes(config);

    expect(types).toEqual(['walk-in']);
  });
});

describe('BookingConfigHelper.isServiceModeEnabled', () => {
  it('returns true for enabled modes', () => {
    const config = createBookingConfigForTest('baseline');

    expect(BookingConfigHelper.isServiceModeEnabled('in-person', config)).toBe(true);
    expect(BookingConfigHelper.isServiceModeEnabled('virtual', config)).toBe(true);
  });

  it('returns false for disabled modes in inPersonOnly', () => {
    const config = createBookingConfigForTest('inPersonOnly');

    expect(BookingConfigHelper.isServiceModeEnabled('in-person', config)).toBe(true);
    expect(BookingConfigHelper.isServiceModeEnabled('virtual', config)).toBe(false);
  });
});

describe('BookingConfigHelper.getTestableFlows', () => {
  it('returns all flow combinations for baseline config', () => {
    const config = createBookingConfigForTest('baseline');
    const flows = BookingConfigHelper.getTestableFlows(config);

    expect(flows).toContain('in-person-prebook');
    expect(flows).toContain('in-person-walk-in');
    expect(flows).toContain('virtual-prebook');
    expect(flows).toContain('virtual-walk-in');
    expect(flows.length).toBe(4);
  });

  it('returns only in-person flows for inPersonOnly config', () => {
    const config = createBookingConfigForTest('inPersonOnly');
    const flows = BookingConfigHelper.getTestableFlows(config);

    expect(flows).toContain('in-person-prebook');
    expect(flows).toContain('in-person-walk-in');
    expect(flows).not.toContain('virtual-prebook');
    expect(flows).not.toContain('virtual-walk-in');
    expect(flows.length).toBe(2);
  });

  it('returns only prebook flows for prebookOnly config', () => {
    const config = createBookingConfigForTest('prebookOnly');
    const flows = BookingConfigHelper.getTestableFlows(config);

    expect(flows).toContain('in-person-prebook');
    expect(flows).toContain('virtual-prebook');
    expect(flows).not.toContain('in-person-walk-in');
    expect(flows).not.toContain('virtual-walk-in');
    expect(flows.length).toBe(2);
  });

  it('returns single flow for combined restrictions', () => {
    // Manually create a restricted config by merging multiple constraints
    const restrictedConfig = createBookingConfigForTest('inPersonOnly');

    // Merge restrictions: in-person + prebook only
    const combinedConfig = {
      ...restrictedConfig,
      serviceCategoriesEnabled: {
        serviceModes: ['in-person'],
        visitType: ['prebook'],
      },
    };

    const flows = BookingConfigHelper.getTestableFlows(combinedConfig);

    expect(flows).toEqual(['in-person-prebook']);
    expect(flows.length).toBe(1);
  });
});

describe('BookingConfigHelper.getHomepageOptions', () => {
  it('returns all homepage options for baseline', () => {
    const config = createBookingConfigForTest('baseline');
    const options = BookingConfigHelper.getHomepageOptions(config);

    expect(options.length).toBeGreaterThan(0);
    expect(options).toContain('start-in-person-visit');
    expect(options).toContain('schedule-in-person-visit');
  });

  it('returns only in-person options for inPersonOnly', () => {
    const config = createBookingConfigForTest('inPersonOnly');
    const options = BookingConfigHelper.getHomepageOptions(config);

    expect(options).toContain('start-in-person-visit');
    expect(options).toContain('schedule-in-person-visit');
    expect(options).not.toContain('start-virtual-visit');
    expect(options).not.toContain('schedule-virtual-visit');
  });
});

describe('BookingConfigHelper.getVisiblePatientFields', () => {
  it('returns all patient fields for baseline config', () => {
    const config = createBookingConfigForTest('baseline');
    const visibleFields = BookingConfigHelper.getVisiblePatientFields(config);

    expect(visibleFields).toBeDefined();
    expect(Array.isArray(visibleFields)).toBe(true);
    expect(visibleFields.length).toBeGreaterThan(0);
    expect(visibleFields).toContain('patient-first-name');
    expect(visibleFields).toContain('patient-last-name');
  });

  it('excludes hidden fields for hiddenPatientFields config', () => {
    const config = createBookingConfigForTest('hiddenPatientFields');
    const visibleFields = BookingConfigHelper.getVisiblePatientFields(config);

    expect(visibleFields).not.toContain('patient-middle-name');
    expect(visibleFields).not.toContain('patient-preferred-name');
  });

  it('returns fewer visible fields for hiddenPatientFields than baseline', () => {
    const baselineConfig = createBookingConfigForTest('baseline');
    const hiddenFieldsConfig = createBookingConfigForTest('hiddenPatientFields');

    const baselineVisible = BookingConfigHelper.getVisiblePatientFields(baselineConfig);
    const hiddenVisible = BookingConfigHelper.getVisiblePatientFields(hiddenFieldsConfig);

    expect(hiddenVisible.length).toBeLessThan(baselineVisible.length);
  });
});

describe('Config isolation', () => {
  it('creates independent config instances', () => {
    const config1 = createBookingConfigForTest('baseline');
    const config2 = createBookingConfigForTest('baseline');

    // Should be separate instances
    expect(config1).not.toBe(config2);

    // But have equal content
    expect(config1.serviceCategoriesEnabled).toEqual(config2.serviceCategoriesEnabled);
  });

  it('different capability configs have different properties', () => {
    const baseline = createBookingConfigForTest('baseline');
    const inPersonOnly = createBookingConfigForTest('inPersonOnly');
    const virtualOnly = createBookingConfigForTest('virtualOnly');

    // Each config should be distinct
    expect(baseline.serviceCategoriesEnabled.serviceModes.length).toBe(2);
    expect(inPersonOnly.serviceCategoriesEnabled.serviceModes.length).toBe(1);
    expect(virtualOnly.serviceCategoriesEnabled.serviceModes.length).toBe(1);
    expect(inPersonOnly.serviceCategoriesEnabled.serviceModes[0]).toBe('in-person');
    expect(virtualOnly.serviceCategoriesEnabled.serviceModes[0]).toBe('virtual');
  });
});
