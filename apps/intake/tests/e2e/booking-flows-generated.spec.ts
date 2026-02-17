console.error('=== booking-flows-generated.spec.ts loaded ===');
/**
 * Generated booking flow tests using test factory
 *
 * This file demonstrates the test factory pattern where we:
 * 1. Generate all valid booking flow permutations from config
 * 2. Create a test for each permutation
 * 3. Test individual steps within each scenario context
 * 4. Run all tests in parallel
 */

import { expect, test } from '@playwright/test';
import { Location, Schedule } from 'fhir/r4b';
import { CanonicalUrl, createBookingConfigForTest, ServiceMode } from 'utils';
import {
  executeBookingScenario,
  generateBookingTestScenarios,
  testScenarioStep,
} from '../utils/booking/BookingTestFactory';
import { TestLocationManager } from '../utils/booking/TestLocationManager';
import { TestQuestionnaireManager } from '../utils/booking/TestQuestionnaireManager';
import { CONCRETE_TEST_CONFIGS, ConcreteTestConfig } from '../utils/booking-flow-concrete-smoke-configs';
import { BookingConfigHelper } from '../utils/config/BookingConfigHelper';
import { LocationsConfigHelper } from '../utils/config/LocationsConfigHelper';

// Helper to extract concrete config ID from scenario configName
function getConcreteConfigId(configName: string): string | undefined {
  if (configName.startsWith('concrete:')) {
    return configName.slice('concrete:'.length);
  }
  return undefined;
}

test.describe.configure({ mode: 'parallel' });

// Shared test locations with 24/7 availability
let testLocationManager: TestLocationManager;
let testQuestionnaireManager: TestQuestionnaireManager;
let walkinLocation: Location;
let _walkinSchedule: Schedule;
let prebookInPersonLocation: Location;
let _prebookInPersonSchedule: Schedule;
let prebookVirtualLocation: Location;
let _prebookVirtualSchedule: Schedule;

// Map of concrete config ID + service mode to test questionnaire canonical
const testQuestionnaireCanonicals: Map<string, CanonicalUrl> = new Map();

// Generate test scenarios from baseline config
const BASE_CONFIG = 'baseline';
const scenarios = await generateBookingTestScenarios(BASE_CONFIG);
console.error('\n=== Scenario Generation Debug ===');
console.error('BASE_CONFIG:', BASE_CONFIG);
console.error('Generated scenarios:', scenarios.length);
for (const scenario of scenarios) {
  console.error(`Scenario: ${scenario.description}`);
  console.error(`  Mode: ${scenario.serviceMode}, Type: ${scenario.visitType}, Category: ${scenario.serviceCategory}`);
  console.error(`  Homepage option: ${scenario.homepageOptionLabel}`);
  console.error(`  Filling strategy: ${JSON.stringify(scenario.fillingStrategy)}`);
}

test.describe('Homepage option rendering', () => {
  test('baseline - homepage shows only enabled booking options', async ({ page }) => {
    const config = createBookingConfigForTest('baseline');
    const homepageOptions = BookingConfigHelper.getHomepageOptions(config);

    await BookingConfigHelper.injectTestConfig(page, config);
    await page.goto('/home');

    // Verify each enabled option is visible by its label text
    for (const option of homepageOptions) {
      await expect(page.getByRole('button', { name: option.label })).toBeVisible();
    }

    // Verify the count matches config
    expect(homepageOptions.length).toBeGreaterThan(0);
  });

  test('inPersonOnly - homepage shows only in-person options', async ({ page }) => {
    const config = createBookingConfigForTest('inPersonOnly');
    const homepageOptions = BookingConfigHelper.getHomepageOptions(config);

    await BookingConfigHelper.injectTestConfig(page, config);
    await page.goto('/home');

    // Should show in-person options by their labels
    for (const option of homepageOptions) {
      await expect(page.getByRole('button', { name: option.label })).toBeVisible();
      expect(option.id).toContain('in-person');
    }

    // Should NOT show virtual options
    await expect(page.getByRole('button', { name: 'Start Virtual Visit' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Schedule Virtual Visit' })).not.toBeVisible();
  });

  test('virtualOnly - homepage shows only virtual options', async ({ page }) => {
    const config = createBookingConfigForTest('virtualOnly');
    const homepageOptions = BookingConfigHelper.getHomepageOptions(config);

    await BookingConfigHelper.injectTestConfig(page, config);
    await page.goto('/home');

    // Should show virtual options by their labels
    for (const option of homepageOptions) {
      await expect(page.getByRole('button', { name: option.label })).toBeVisible();
      expect(option.id).toContain('virtual');
    }

    // Should NOT show in-person options
    await expect(page.getByRole('button', { name: 'Start In-Person Visit' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Schedule In-Person Visit' })).not.toBeVisible();
  });
});

// Store loaded concrete configs for location lookup
let loadedConcreteConfigs: ConcreteTestConfig[] = [];

test.describe('Complete booking flows - all permutations', () => {
  // Setup: Create test locations and questionnaires for walk-in and prebook tests
  test.beforeAll(async () => {
    // Generate a unique ID for this worker to isolate test resources
    // This prevents race conditions when multiple workers run in parallel
    const suiteId = process.env.PLAYWRIGHT_SUITE_ID || 'unknown';
    const workerUniqueId = `${suiteId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`Worker unique ID: ${workerUniqueId}`);

    testLocationManager = new TestLocationManager(workerUniqueId);
    testQuestionnaireManager = new TestQuestionnaireManager(workerUniqueId);
    await testLocationManager.init();
    await testQuestionnaireManager.init();

    // Create walk-in in-person test location (24/7, high capacity for walk-ins)
    const walkinResult = await testLocationManager.ensureAlwaysOpenLocation();
    walkinLocation = walkinResult.location;
    _walkinSchedule = walkinResult.schedule;
    console.log(`✓ Created 24/7 walk-in location: ${walkinLocation.name} (ID: ${walkinLocation.id})`);

    // Create prebook in-person test location (24/7, 8 slots per hour)
    const prebookInPersonResult = await testLocationManager.ensurePrebookInPersonLocationWithSlots();
    prebookInPersonLocation = prebookInPersonResult.location;
    _prebookInPersonSchedule = prebookInPersonResult.schedule;
    console.log(
      `✓ Created 24/7 prebook in-person location: ${prebookInPersonLocation.name} (ID: ${prebookInPersonLocation.id})`
    );

    // Create prebook virtual test location (24/7, 8 slots per hour)
    const prebookVirtualResult = await testLocationManager.ensurePrebookVirtualLocationWithSlots();
    prebookVirtualLocation = prebookVirtualResult.location;
    _prebookVirtualSchedule = prebookVirtualResult.schedule;
    console.log(
      `✓ Created 24/7 prebook virtual location: ${prebookVirtualLocation.name} (ID: ${prebookVirtualLocation.id})`
    );

    // Create locations for each concrete config
    loadedConcreteConfigs = await CONCRETE_TEST_CONFIGS;
    for (const concreteConfig of loadedConcreteConfigs) {
      const createdLocations = await testLocationManager.ensureConcreteConfigLocations(
        concreteConfig.id,
        concreteConfig.locationsOverrides
      );
      console.log(
        `✓ Created ${createdLocations.length} locations for concrete config: ${concreteConfig.name} (${concreteConfig.id})`
      );
      for (const loc of createdLocations) {
        console.log(`  - ${loc.originalName} → ${loc.suffixedName} (${loc.isVirtual ? 'virtual' : 'in-person'})`);
      }
    }

    // Deploy test questionnaires for each concrete config
    // This ensures the questionnaire in FHIR has the hidden fields and other customizations
    for (const concreteConfig of loadedConcreteConfigs) {
      if (concreteConfig.paperworkConfigInPerson) {
        const inPersonResult = await testQuestionnaireManager.ensureTestQuestionnaire(
          concreteConfig.id,
          concreteConfig.paperworkConfigInPerson,
          ServiceMode['in-person']
        );
        testQuestionnaireCanonicals.set(`${concreteConfig.id}-in-person`, inPersonResult.canonical);
        console.log(
          `✓ Deployed in-person test questionnaire for ${concreteConfig.name}: ${inPersonResult.canonical.url}|${inPersonResult.canonical.version}`
        );
      }

      if (concreteConfig.paperworkConfigVirtual) {
        const virtualResult = await testQuestionnaireManager.ensureTestQuestionnaire(
          concreteConfig.id,
          concreteConfig.paperworkConfigVirtual,
          ServiceMode['virtual']
        );
        testQuestionnaireCanonicals.set(`${concreteConfig.id}-virtual`, virtualResult.canonical);
        console.log(
          `✓ Deployed virtual test questionnaire for ${concreteConfig.name}: ${virtualResult.canonical.url}|${virtualResult.canonical.version}`
        );
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
    test(`${scenario.description} - complete flow with paperwork`, async ({ page }) => {
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
          // Inject the test questionnaire canonical into the scenario
          scenario.testQuestionnaireCanonical = testCanonical;
          console.log(`Using test questionnaire for ${canonicalKey}: ${testCanonical.url}|${testCanonical.version}`);
        }
      } else {
        // Capability config scenario: use default synthetic locations
        if (scenario.visitType === 'walk-in') {
          // Walk-in uses different locations for in-person vs virtual
          locationName = scenario.serviceMode === 'virtual' ? prebookVirtualLocation.name! : walkinLocation.name!;
        } else {
          // Prebook uses different locations for in-person vs virtual
          locationName =
            scenario.serviceMode === 'virtual' ? prebookVirtualLocation.name! : prebookInPersonLocation.name!;
        }
      }

      // Execute booking AND paperwork (scenario contains all resolved config)
      const appointmentResponse = await executeBookingScenario(page, scenario, locationName);

      // Verify we reached confirmation and have appointment data
      expect(appointmentResponse.appointmentId).toBeTruthy();
      expect(appointmentResponse.fhirPatientId).toBeTruthy();
      expect(appointmentResponse.resources.appointment).toBeTruthy();
      expect(appointmentResponse.resources.patient).toBeTruthy();

      // Verify we completed paperwork and reached final confirmation
      // In-person walk-in goes to /check-in, prebook (any) goes to /visit/{id}, virtual walk-in goes to /waiting-room
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

      console.log(
        `✓ Created appointment ${appointmentResponse.appointmentId} for patient ${appointmentResponse.fhirPatientId}`
      );
      console.log(`✓ Completed paperwork for scenario: ${scenario.description}`);
    });

    // todo: add ability to create 24/7 locations from TestLocationManager that reads from the location
    // config. we then need to tie the various generated flows from the concrete overrides to their test locations.
  }
});

test.describe('Service category selection - per scenario', () => {
  // Test service category selection for each homepage option
  const uniqueHomepageLabels = [...new Set(scenarios.map((s) => s.homepageOptionLabel))];

  for (const optionLabel of uniqueHomepageLabels) {
    test(`${optionLabel} - service category selection behavior`, async ({ page }) => {
      const config = createBookingConfigForTest(BASE_CONFIG);
      const scenario = scenarios.find((s) => s.homepageOptionLabel === optionLabel)!;

      await testScenarioStep(page, scenario, config, 'service-category');
    });
  }
});

test.describe('Patient info form - per scenario', () => {
  // Test patient info for each unique combination of homepage option + service category
  for (const scenario of scenarios) {
    test(`${scenario.description} - patient info fields`, async ({ page }) => {
      await testScenarioStep(page, scenario, scenario.resolvedConfig, 'patient-info');
    });
  }
});

test.describe('Location selection - per scenario', () => {
  for (const scenario of scenarios) {
    test(`${scenario.description} - location selection`, async ({ page }) => {
      await testScenarioStep(page, scenario, scenario.resolvedConfig, 'location');
    });
  }
});

test.describe('Time slot selection - prebook scenarios only', () => {
  const prebookScenarios = scenarios.filter((s) => s.visitType === 'prebook');

  for (const scenario of prebookScenarios) {
    test(`${scenario.description} - time slot selection`, async ({ page }) => {
      await testScenarioStep(page, scenario, scenario.resolvedConfig, 'time-slot');
    });
  }
});

test.describe('Cross-config validation', () => {
  test('inPersonOnly config generates only in-person scenarios', async () => {
    const inPersonScenarios = await generateBookingTestScenarios('inPersonOnly');

    expect(inPersonScenarios.length).toBeGreaterThan(0);
    expect(inPersonScenarios.every((s) => s.serviceMode === 'in-person')).toBe(true);
    expect(inPersonScenarios.some((s) => s.serviceMode === 'virtual')).toBe(false);
  });

  test('virtualOnly config generates only virtual scenarios', async () => {
    const virtualScenarios = await generateBookingTestScenarios('virtualOnly');

    expect(virtualScenarios.length).toBeGreaterThan(0);
    expect(virtualScenarios.every((s) => s.serviceMode === 'virtual')).toBe(true);
    expect(virtualScenarios.some((s) => s.serviceMode === 'in-person')).toBe(false);
  });

  test('prebookOnly config generates only prebook scenarios', async () => {
    const prebookScenarios = await generateBookingTestScenarios('prebookOnly');

    expect(prebookScenarios.length).toBeGreaterThan(0);
    expect(prebookScenarios.every((s) => s.visitType === 'prebook')).toBe(true);
    expect(prebookScenarios.some((s) => s.visitType === 'walk-in')).toBe(false);
  });

  test('urgentCareOnly config generates scenarios with single service category', async () => {
    const urgentCareScenarios = await generateBookingTestScenarios('urgentCareOnly');

    expect(urgentCareScenarios.length).toBeGreaterThan(0);
    expect(urgentCareScenarios.every((s) => s.serviceCategory === 'urgent-care')).toBe(true);
  });

  test('baseline config generates full matrix of scenarios', async () => {
    const baselineScenarios = await generateBookingTestScenarios('baseline');

    // Should have scenarios for both service modes
    expect(baselineScenarios.some((s) => s.serviceMode === 'in-person')).toBe(true);
    expect(baselineScenarios.some((s) => s.serviceMode === 'virtual')).toBe(true);

    // Should have scenarios for both visit types
    expect(baselineScenarios.some((s) => s.visitType === 'walk-in')).toBe(true);
    expect(baselineScenarios.some((s) => s.visitType === 'prebook')).toBe(true);

    // Should have multiple service categories
    const uniqueCategories = new Set(baselineScenarios.map((s) => s.serviceCategory));
    expect(uniqueCategories.size).toBeGreaterThan(1);
  });
});

test.describe('Scenario matrix info', () => {
  test('log all generated scenarios for baseline', async () => {
    const baselineScenarios = await generateBookingTestScenarios('baseline');

    console.log('\n=== Generated Test Scenarios ===');
    console.log(`Total scenarios: ${baselineScenarios.length}\n`);

    for (const scenario of baselineScenarios) {
      console.log(`- ${scenario.description}`);
      console.log(`  Mode: ${scenario.serviceMode}, Type: ${scenario.visitType}`);
    }

    expect(baselineScenarios.length).toBeGreaterThan(0);
  });
});
