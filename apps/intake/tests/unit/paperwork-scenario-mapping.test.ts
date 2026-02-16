/**
 * Unit tests for paperwork config to booking scenario mapping
 *
 * Verifies that booking scenarios are assigned appropriate paperwork configs
 * based on service category, visit type, and service mode.
 */

import { describe, expect, it } from 'vitest';
import { generateBookingTestScenarios } from '../utils/booking/BookingTestFactory';

describe('Paperwork Config Assignment', () => {
  it('assigns baseline-in-person to urgent-care in-person walk-in', () => {
    const scenarios = generateBookingTestScenarios('baseline');
    const scenario = scenarios.find(
      (s) => s.serviceCategory === 'urgent-care' && s.visitType === 'walk-in' && s.serviceMode === 'in-person'
    );

    expect(scenario).toBeDefined();
    expect(scenario?.paperworkConfig).toBe('baseline-in-person');
  });

  it('assigns required-only-in-person to urgent-care in-person prebook', () => {
    const scenarios = generateBookingTestScenarios('baseline');
    const scenario = scenarios.find(
      (s) => s.serviceCategory === 'urgent-care' && s.visitType === 'prebook' && s.serviceMode === 'in-person'
    );

    expect(scenario).toBeDefined();
    expect(scenario?.paperworkConfig).toBe('required-only-in-person');
  });

  it('assigns baseline-virtual to urgent-care virtual walk-in', () => {
    const scenarios = generateBookingTestScenarios('baseline');
    const scenario = scenarios.find(
      (s) => s.serviceCategory === 'urgent-care' && s.visitType === 'walk-in' && s.serviceMode === 'virtual'
    );

    expect(scenario).toBeDefined();
    expect(scenario?.paperworkConfig).toBe('baseline-virtual');
  });

  it('assigns minimal-virtual to urgent-care virtual prebook', () => {
    const scenarios = generateBookingTestScenarios('baseline');
    const scenario = scenarios.find(
      (s) => s.serviceCategory === 'urgent-care' && s.visitType === 'prebook' && s.serviceMode === 'virtual'
    );

    expect(scenario).toBeDefined();
    expect(scenario?.paperworkConfig).toBe('minimal-virtual');
  });

  it('assigns workers-comp-in-person to workers-comp scenarios', () => {
    const scenarios = generateBookingTestScenarios('baseline');
    const workersCompScenarios = scenarios.filter((s) => s.serviceCategory === 'workers-comp');

    expect(workersCompScenarios.length).toBeGreaterThan(0);
    workersCompScenarios.forEach((scenario) => {
      expect(scenario.paperworkConfig).toBe('workers-comp-in-person');
    });
  });

  it('assigns occ-med-in-person to occ-med scenarios when present', () => {
    const scenarios = generateBookingTestScenarios('baseline');
    const occMedScenarios = scenarios.filter((s) => s.serviceCategory === 'occ-med');

    // Skip test if baseline config doesn't include occ-med
    if (occMedScenarios.length === 0) {
      return;
    }

    occMedScenarios.forEach((scenario) => {
      expect(scenario.paperworkConfig).toBe('occ-med-in-person');
    });
  });

  it('assigns paperwork config to every generated scenario', () => {
    const scenarios = generateBookingTestScenarios('baseline');

    expect(scenarios.length).toBeGreaterThan(0);
    scenarios.forEach((scenario) => {
      expect(scenario.paperworkConfig).toBeDefined();
      expect(typeof scenario.paperworkConfig).toBe('string');
    });
  });

  it('uses consistent mapping across different booking configs', () => {
    const baselineScenarios = generateBookingTestScenarios('baseline');
    const inPersonOnlyScenarios = generateBookingTestScenarios('inPersonOnly');

    // Find matching scenarios (same service category, visit type, service mode)
    const baselineUrgentWalkIn = baselineScenarios.find(
      (s) => s.serviceCategory === 'urgent-care' && s.visitType === 'walk-in' && s.serviceMode === 'in-person'
    );

    const inPersonOnlyUrgentWalkIn = inPersonOnlyScenarios.find(
      (s) => s.serviceCategory === 'urgent-care' && s.visitType === 'walk-in' && s.serviceMode === 'in-person'
    );

    // Same characteristics should map to same paperwork config
    if (baselineUrgentWalkIn && inPersonOnlyUrgentWalkIn) {
      expect(baselineUrgentWalkIn.paperworkConfig).toBe(inPersonOnlyUrgentWalkIn.paperworkConfig);
    }
  });
});
