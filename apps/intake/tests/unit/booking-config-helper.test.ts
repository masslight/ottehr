/**
 * Unit tests for booking capability configs
 *
 * These tests validate that createBookingConfigForTest() creates proper config instances
 * for different capability configurations.
 */

import { createBookingConfigForTest } from 'utils';
import { describe, expect, it } from 'vitest';

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
