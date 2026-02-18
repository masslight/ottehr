/**
 * Generated end-to-end booking flow tests
 *
 * This file generates comprehensive tests for all valid booking flow permutations:
 * - Homepage options (walk-in vs prebook, in-person vs virtual)
 * - Service categories (urgent-care, occupational-medicine, workers-comp)
 * - Concrete config variations (instance-specific paperwork customizations)
 *
 * Each test covers the complete flow: homepage → booking → paperwork → completion
 * Tests run in parallel with isolated test resources (locations, questionnaires).
 */

import { expect, test } from '@playwright/test';
import { Location, Schedule } from 'fhir/r4b';
import { CanonicalUrl, ServiceMode } from 'utils';
import { executeBookingScenario, generateBookingTestScenarios } from '../utils/booking/BookingTestFactory';
import {
  executeCancellationFlow,
  executeModificationFlow,
  executeReturningPatientFlow,
  shouldExtendWithCancellation,
  shouldExtendWithModification,
  shouldExtendWithReturningPatient,
} from '../utils/booking/ExtendedScenarioHelpers';
import { TestLocationManager } from '../utils/booking/TestLocationManager';
import { TestQuestionnaireManager } from '../utils/booking/TestQuestionnaireManager';
import { CONCRETE_TEST_CONFIGS, ConcreteTestConfig } from '../utils/booking-flow-concrete-smoke-configs';
import { LocationsConfigHelper } from '../utils/config/LocationsConfigHelper';

// Helper to extract concrete config ID from scenario configName
function getConcreteConfigId(configName: string): string | undefined {
  if (configName.startsWith('concrete:')) {
    return configName.slice('concrete:'.length);
  }
  return undefined;
}

test.describe.configure({ mode: 'parallel' });

// Shared test resources
let testLocationManager: TestLocationManager;
let testQuestionnaireManager: TestQuestionnaireManager;
let walkinLocation: Location;
let _walkinSchedule: Schedule;
let prebookInPersonLocation: Location;
let _prebookInPersonSchedule: Schedule;
let prebookVirtualLocation: Location;
let _prebookVirtualSchedule: Schedule;
let loadedConcreteConfigs: ConcreteTestConfig[] = [];
const testQuestionnaireCanonicals: Map<string, CanonicalUrl> = new Map();

// Generate test scenarios from baseline config
const scenarios = await generateBookingTestScenarios('baseline');

test.describe('Complete booking flows', () => {
  // Setup: Create test locations and questionnaires
  test.beforeAll(async () => {
    // Generate a unique ID for this worker to isolate test resources
    const suiteId = process.env.PLAYWRIGHT_SUITE_ID || 'unknown';
    const workerUniqueId = `${suiteId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`Worker unique ID: ${workerUniqueId}`);

    testLocationManager = new TestLocationManager(workerUniqueId);
    testQuestionnaireManager = new TestQuestionnaireManager(workerUniqueId);
    await testLocationManager.init();
    await testQuestionnaireManager.init();

    // Create walk-in in-person test location (24/7, high capacity)
    const walkinResult = await testLocationManager.ensureAlwaysOpenLocation();
    walkinLocation = walkinResult.location;
    _walkinSchedule = walkinResult.schedule;
    console.log(`✓ Created walk-in location: ${walkinLocation.name}`);

    // Create prebook in-person test location (24/7, 8 slots per hour)
    const prebookInPersonResult = await testLocationManager.ensurePrebookInPersonLocationWithSlots();
    prebookInPersonLocation = prebookInPersonResult.location;
    _prebookInPersonSchedule = prebookInPersonResult.schedule;
    console.log(`✓ Created prebook in-person location: ${prebookInPersonLocation.name}`);

    // Create prebook virtual test location (24/7, 8 slots per hour)
    const prebookVirtualResult = await testLocationManager.ensurePrebookVirtualLocationWithSlots();
    prebookVirtualLocation = prebookVirtualResult.location;
    _prebookVirtualSchedule = prebookVirtualResult.schedule;
    console.log(`✓ Created prebook virtual location: ${prebookVirtualLocation.name}`);

    // Create locations for each concrete config
    loadedConcreteConfigs = await CONCRETE_TEST_CONFIGS;
    for (const concreteConfig of loadedConcreteConfigs) {
      const createdLocations = await testLocationManager.ensureConcreteConfigLocations(
        concreteConfig.id,
        concreteConfig.locationsOverrides
      );
      console.log(`✓ Created ${createdLocations.length} locations for ${concreteConfig.name}`);
    }

    // Deploy test questionnaires for each concrete config
    for (const concreteConfig of loadedConcreteConfigs) {
      if (concreteConfig.paperworkConfigInPerson) {
        const inPersonResult = await testQuestionnaireManager.ensureTestQuestionnaire(
          concreteConfig.id,
          concreteConfig.paperworkConfigInPerson,
          ServiceMode['in-person']
        );
        testQuestionnaireCanonicals.set(`${concreteConfig.id}-in-person`, inPersonResult.canonical);
        console.log(`✓ Deployed in-person questionnaire for ${concreteConfig.name}`);
      }

      if (concreteConfig.paperworkConfigVirtual) {
        const virtualResult = await testQuestionnaireManager.ensureTestQuestionnaire(
          concreteConfig.id,
          concreteConfig.paperworkConfigVirtual,
          ServiceMode['virtual']
        );
        testQuestionnaireCanonicals.set(`${concreteConfig.id}-virtual`, virtualResult.canonical);
        console.log(`✓ Deployed virtual questionnaire for ${concreteConfig.name}`);
      }
    }
  });

  // Cleanup: Remove test resources after all tests
  test.afterAll(async () => {
    if (testLocationManager) {
      await testLocationManager.cleanup();
      console.log('✓ Cleaned up test locations and schedules');
    }
    if (testQuestionnaireManager) {
      await testQuestionnaireManager.cleanup();
      console.log('✓ Cleaned up test questionnaires');
    }
  });

  // Generate a test for each scenario
  for (const scenario of scenarios) {
    test(`${scenario.description}`, async ({ page }) => {
      // Choose the appropriate test location based on scenario type
      let locationName: string;

      const concreteConfigId = getConcreteConfigId(scenario.configName);
      if (concreteConfigId) {
        // Concrete config scenario: use locations from the concrete config
        const concreteConfig = loadedConcreteConfigs.find((c) => c.id === concreteConfigId);
        if (!concreteConfig) {
          throw new Error(`Concrete config not found: ${concreteConfigId}`);
        }

        const concreteLocations = testLocationManager.getConcreteConfigLocations(concreteConfigId);
        const isVirtual = scenario.serviceMode === 'virtual';

        // Transform and inject the locations config with suffixed names
        const transformedLocations = LocationsConfigHelper.transformLocationsForInjection(
          concreteConfig.locationsOverrides,
          concreteLocations
        );
        await LocationsConfigHelper.injectLocationsConfig(page, transformedLocations);

        // Pick the first location of the appropriate type
        const matchingLocation = concreteLocations.find((loc) => loc.isVirtual === isVirtual);
        if (!matchingLocation) {
          throw new Error(
            `No ${isVirtual ? 'virtual' : 'in-person'} location found for concrete config: ${concreteConfigId}`
          );
        }
        locationName = matchingLocation.suffixedName;

        // Get the test questionnaire canonical for this concrete config
        const canonicalKey = `${concreteConfigId}-${scenario.serviceMode}`;
        const testCanonical = testQuestionnaireCanonicals.get(canonicalKey);
        if (testCanonical) {
          scenario.testQuestionnaireCanonical = testCanonical;
        }
      } else {
        // Capability config scenario: use default synthetic locations
        if (scenario.visitType === 'walk-in') {
          locationName = scenario.serviceMode === 'virtual' ? prebookVirtualLocation.name! : walkinLocation.name!;
        } else {
          locationName =
            scenario.serviceMode === 'virtual' ? prebookVirtualLocation.name! : prebookInPersonLocation.name!;
        }
      }

      // Execute complete booking flow with paperwork
      const appointmentResponse = await executeBookingScenario(page, scenario, locationName);

      // Verify appointment was created
      expect(appointmentResponse.appointmentId).toBeTruthy();
      expect(appointmentResponse.fhirPatientId).toBeTruthy();
      expect(appointmentResponse.resources.appointment).toBeTruthy();
      expect(appointmentResponse.resources.patient).toBeTruthy();

      // Verify we reached the correct completion page
      let completionPathMatches: boolean;
      if (scenario.serviceMode === 'in-person' && scenario.visitType === 'walk-in') {
        completionPathMatches = page.url().includes('/check-in');
      } else if (scenario.visitType === 'prebook') {
        completionPathMatches = /\/visit\/[a-f0-9-]+$/.test(page.url());
      } else {
        // Virtual walk-in
        completionPathMatches = page.url().includes('/waiting-room');
      }
      expect(completionPathMatches).toBe(true);

      console.log(`✓ ${scenario.description}: appointment ${appointmentResponse.appointmentId}`);

      // Extended P1 coverage: returning patient, modification, and cancellation flows
      // These are distributed across different scenarios to maintain parallelization

      if (shouldExtendWithReturningPatient(scenario, scenarios)) {
        await executeReturningPatientFlow(page, scenario, appointmentResponse);
      }

      if (shouldExtendWithModification(scenario, scenarios)) {
        await executeModificationFlow(page, appointmentResponse);
      }

      if (shouldExtendWithCancellation(scenario, scenarios)) {
        await executeCancellationFlow(page, appointmentResponse, scenario.serviceMode);
      }
    });
  }
});
