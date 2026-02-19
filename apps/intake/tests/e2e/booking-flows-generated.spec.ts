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
import { CanonicalUrl, getConsentFormsConfig, resolveConsentFormsPaths, ServiceMode } from 'utils';
import { executeBookingScenario, generateBookingTestScenarios } from '../utils/booking/BookingTestFactory';
import {
  // P1: Critical User Journeys
  executeCancellationFlow,
  executeModificationFlow,
  // P2: Important Features
  executePastVisitsFlow,
  executeReturningPatientFlow,
  executeReviewPageVerification,
  executeWaitingRoomParticipantsFlow,
  shouldExtendWithCancellation,
  shouldExtendWithModification,
  shouldExtendWithPastVisits,
  shouldExtendWithReturningPatient,
  shouldExtendWithReviewPageVerification,
  shouldExtendWithWaitingRoomParticipants,
} from '../utils/booking/ExtendedScenarioHelpers';
import { CreatedGroupBookingResources, TestLocationManager } from '../utils/booking/TestLocationManager';
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
let prebookInPersonGroup: CreatedGroupBookingResources;
let loadedConcreteConfigs: ConcreteTestConfig[] = [];
const testQuestionnaireCanonicals: Map<string, CanonicalUrl> = new Map();

// Generate test scenarios from baseline config
// NOTE: Concrete scenarios are only generated when RUN_CONCRETE_TESTS=true (upstream ottehr repo only)
const scenarios = await generateBookingTestScenarios('baseline');

// Check if concrete tests are enabled (upstream ottehr repo only)
const runConcreteTests = process.env.RUN_CONCRETE_TESTS === 'true';

// Load concrete configs at top level for grouping (only if enabled)
const concreteConfigs = runConcreteTests ? await CONCRETE_TEST_CONFIGS : [];

// Group scenarios by config type for organized test output
const syntheticScenarios = scenarios.filter((s) => !s.configName.startsWith('concrete:'));
const concreteScenarioGroups = new Map<string, { name: string; scenarios: typeof scenarios }>();
for (const scenario of scenarios.filter((s) => s.configName.startsWith('concrete:'))) {
  const configId = getConcreteConfigId(scenario.configName)!;
  if (!concreteScenarioGroups.has(configId)) {
    const config = concreteConfigs.find((c) => c.id === configId);
    concreteScenarioGroups.set(configId, {
      name: config?.name || configId,
      scenarios: [],
    });
  }
  concreteScenarioGroups.get(configId)!.scenarios.push(scenario);
}

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

    // Create prebook in-person group (HealthcareService with Location + Practitioner members)
    // This tests the "group booking" pattern used by the core environment
    prebookInPersonGroup = await testLocationManager.ensurePrebookInPersonGroupWithSlots();
    console.log(`✓ Created prebook in-person group: ${prebookInPersonGroup.name}`);

    // Configure urgent care prebook in-person scenario to use Group booking
    // This tests the "group booking" pattern used by the core environment
    const urgentCarePrebookInPerson = scenarios.find(
      (s) =>
        s.visitType === 'prebook' &&
        s.serviceMode === 'in-person' &&
        s.serviceCategory === 'urgent-care' &&
        !s.configName.startsWith('concrete:')
    );
    if (urgentCarePrebookInPerson) {
      urgentCarePrebookInPerson.bookableEntityType = 'Group';
      urgentCarePrebookInPerson.groupBookingSlug = prebookInPersonGroup.slug;
      console.log(
        `✓ Configured scenario "${urgentCarePrebookInPerson.description}" to use Group booking (slug: ${prebookInPersonGroup.slug})`
      );
    }

    // Create locations and questionnaires for each concrete config (upstream ottehr repo only)
    if (runConcreteTests) {
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
        // Resolve consent forms for this config (needed for questionnaire generation)
        const resolvedConsentFormsConfig = getConsentFormsConfig(concreteConfig.consentFormsOverrides || {});
        const resolvedConsentForms = resolveConsentFormsPaths(resolvedConsentFormsConfig.forms);

        if (concreteConfig.paperworkConfigInPerson) {
          const inPersonResult = await testQuestionnaireManager.ensureTestQuestionnaire(
            concreteConfig.id,
            concreteConfig.paperworkConfigInPerson,
            ServiceMode['in-person'],
            resolvedConsentForms
          );
          testQuestionnaireCanonicals.set(`${concreteConfig.id}-in-person`, inPersonResult.canonical);
          console.log(`✓ Deployed in-person questionnaire for ${concreteConfig.name}`);
        }

        if (concreteConfig.paperworkConfigVirtual) {
          const virtualResult = await testQuestionnaireManager.ensureTestQuestionnaire(
            concreteConfig.id,
            concreteConfig.paperworkConfigVirtual,
            ServiceMode['virtual'],
            resolvedConsentForms
          );
          testQuestionnaireCanonicals.set(`${concreteConfig.id}-virtual`, virtualResult.canonical);
          console.log(`✓ Deployed virtual questionnaire for ${concreteConfig.name}`);
        }
      }
    } else {
      console.log('Skipping concrete config resource creation (RUN_CONCRETE_TESTS != true)');
    }

    // Deploy isolated test questionnaires for baseline/synthetic scenarios
    // This ensures parallel CI runs don't interfere with each other
    const baselineInPersonResult = await testQuestionnaireManager.ensureTestQuestionnaire(
      'baseline',
      {}, // No overrides - use default config
      ServiceMode['in-person']
    );
    testQuestionnaireCanonicals.set('baseline-in-person', baselineInPersonResult.canonical);
    console.log('✓ Deployed baseline in-person questionnaire');

    const baselineVirtualResult = await testQuestionnaireManager.ensureTestQuestionnaire(
      'baseline',
      {}, // No overrides - use default config
      ServiceMode['virtual']
    );
    testQuestionnaireCanonicals.set('baseline-virtual', baselineVirtualResult.canonical);
    console.log('✓ Deployed baseline virtual questionnaire');
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

  // ===========================================================================
  // SYNTHETIC TESTS (baseline config)
  // Run with: npx playwright test --grep "Synthetic"
  // ===========================================================================
  test.describe('Synthetic (baseline)', () => {
    for (const scenario of syntheticScenarios) {
      test(`${scenario.description}`, async ({ page }) => {
        // Capability config scenario: use default synthetic locations
        let locationName: string;
        if (scenario.visitType === 'walk-in') {
          locationName = scenario.serviceMode === 'virtual' ? prebookVirtualLocation.name! : walkinLocation.name!;
        } else if (scenario.bookableEntityType === 'Group') {
          // Use Group booking (HealthcareService) for this scenario
          locationName = prebookInPersonGroup.name;
        } else {
          locationName =
            scenario.serviceMode === 'virtual' ? prebookVirtualLocation.name! : prebookInPersonLocation.name!;
        }

        // Get the baseline test questionnaire canonical for CI isolation
        const baselineCanonicalKey = `baseline-${scenario.serviceMode}`;
        const baselineCanonical = testQuestionnaireCanonicals.get(baselineCanonicalKey);
        if (baselineCanonical) {
          scenario.testQuestionnaireCanonical = baselineCanonical;
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
          completionPathMatches = /\/visit\/[a-f0-9-]+/.test(page.url());
        } else {
          completionPathMatches = page.url().includes('/waiting-room');
        }
        expect(completionPathMatches).toBe(true);

        console.log(`✓ ${scenario.description}: appointment ${appointmentResponse.appointmentId}`);

        // Extended P1 coverage
        if (shouldExtendWithReturningPatient(scenario, syntheticScenarios)) {
          await executeReturningPatientFlow(page, scenario, appointmentResponse);
        }
        if (shouldExtendWithModification(scenario, syntheticScenarios)) {
          await executeModificationFlow(page, appointmentResponse);
        }
        if (shouldExtendWithCancellation(scenario, syntheticScenarios)) {
          await executeCancellationFlow(page, appointmentResponse, scenario.serviceMode);
        }

        // Extended P2 coverage
        if (shouldExtendWithWaitingRoomParticipants(scenario, syntheticScenarios)) {
          await executeWaitingRoomParticipantsFlow(page);
        }
        if (shouldExtendWithPastVisits(scenario, syntheticScenarios)) {
          await executePastVisitsFlow(page, appointmentResponse);
        }
        if (shouldExtendWithReviewPageVerification(scenario, syntheticScenarios)) {
          await executeReviewPageVerification(page, appointmentResponse.appointmentId, scenario.serviceMode);
        }
      });
    }
  });

  // ===========================================================================
  // CONCRETE CONFIG TESTS (instance-specific configurations)
  // These tests only run in the upstream ottehr repo (RUN_CONCRETE_TESTS=true)
  // When disabled, concreteScenarioGroups is empty and no tests are generated
  // Run with: npx playwright test --grep "Concrete: <config-name>"
  // ===========================================================================
  for (const [configId, { name: configName, scenarios: configScenarios }] of concreteScenarioGroups) {
    test.describe(`Concrete: ${configName}`, () => {
      for (const scenario of configScenarios) {
        test(`${scenario.description}`, async ({ page }) => {
          // Concrete config scenario: use locations from the concrete config
          const concreteConfig = loadedConcreteConfigs.find((c) => c.id === configId);
          if (!concreteConfig) {
            throw new Error(`Concrete config not found: ${configId}`);
          }

          const concreteLocations = testLocationManager.getConcreteConfigLocations(configId);
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
              `No ${isVirtual ? 'virtual' : 'in-person'} location found for concrete config: ${configId}`
            );
          }
          const locationName = matchingLocation.suffixedName;

          // Get the test questionnaire canonical for this concrete config
          const canonicalKey = `${configId}-${scenario.serviceMode}`;
          const testCanonical = testQuestionnaireCanonicals.get(canonicalKey);
          if (testCanonical) {
            scenario.testQuestionnaireCanonical = testCanonical;
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
            completionPathMatches = /\/visit\/[a-f0-9-]+/.test(page.url());
          } else {
            completionPathMatches = page.url().includes('/waiting-room');
          }
          expect(completionPathMatches).toBe(true);

          console.log(`✓ ${scenario.description}: appointment ${appointmentResponse.appointmentId}`);

          // Extended P1 coverage
          if (shouldExtendWithReturningPatient(scenario, configScenarios)) {
            await executeReturningPatientFlow(page, scenario, appointmentResponse);
          }
          if (shouldExtendWithModification(scenario, configScenarios)) {
            await executeModificationFlow(page, appointmentResponse);
          }
          if (shouldExtendWithCancellation(scenario, configScenarios)) {
            await executeCancellationFlow(page, appointmentResponse, scenario.serviceMode);
          }

          // Extended P2 coverage
          if (shouldExtendWithWaitingRoomParticipants(scenario, configScenarios)) {
            await executeWaitingRoomParticipantsFlow(page);
          }
          if (shouldExtendWithPastVisits(scenario, configScenarios)) {
            await executePastVisitsFlow(page, appointmentResponse);
          }
          if (shouldExtendWithReviewPageVerification(scenario, configScenarios)) {
            await executeReviewPageVerification(page, appointmentResponse.appointmentId, scenario.serviceMode);
          }
        });
      }
    });
  }
});
