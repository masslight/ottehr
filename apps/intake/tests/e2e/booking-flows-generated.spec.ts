/**
 * Generated end-to-end booking flow tests
 *
 * This file generates comprehensive tests for all valid booking flow permutations:
 * - Homepage options (walk-in vs prebook, in-person vs virtual)
 * - Service categories (urgent-care, occupational-medicine, workers-comp)
 *
 * Each test covers the complete flow: homepage → booking → paperwork → completion
 * Tests run in parallel with isolated test resources (locations, questionnaires).
 *
 * Configuration is driven by ottehr-config-overrides - downstream instances can
 * customize behavior by populating those files with instance-specific values.
 */

import { expect, test } from '@playwright/test';
import { Location, Schedule } from 'fhir/r4b';
import { CanonicalUrl, ServiceMode } from 'utils';
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
const testQuestionnaireCanonicals: Map<string, CanonicalUrl> = new Map();

// Generate test scenarios from instance's BOOKING_CONFIG
// Configuration comes from ottehr-config-overrides - downstream instances can
// customize behavior by populating those files with instance-specific values
const scenarios = await generateBookingTestScenarios();

test.describe('Complete booking flows', () => {
  // Setup: Create test locations and questionnaires
  test.beforeAll(async () => {
    // Generate a short unique ID for this worker to isolate test resources
    // Use base36 timestamp (last 6 chars) + random (6 chars) = 12 chars total
    // This keeps location names under 60 chars to avoid UI truncation issues
    const shortTimestamp = Date.now().toString(36).slice(-6);
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const workerUniqueId = `${shortTimestamp}${randomSuffix}`;
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
      (s) => s.visitType === 'prebook' && s.serviceMode === 'in-person' && s.serviceCategory === 'urgent-care'
    );
    if (urgentCarePrebookInPerson) {
      urgentCarePrebookInPerson.bookableEntityType = 'Group';
      urgentCarePrebookInPerson.groupBookingSlug = prebookInPersonGroup.slug;
      console.log(
        `✓ Configured scenario "${urgentCarePrebookInPerson.description}" to use Group booking (slug: ${prebookInPersonGroup.slug})`
      );
    }

    // Deploy isolated test questionnaires for baseline scenarios
    // This ensures parallel CI runs don't interfere with each other
    // Uses the pre-resolved instance config (has downstream overrides baked in)
    const baselineInPersonResult = await testQuestionnaireManager.ensureTestQuestionnaire(
      'baseline',
      ServiceMode['in-person']
    );
    testQuestionnaireCanonicals.set('baseline-in-person', baselineInPersonResult.canonical);
    console.log('✓ Deployed baseline in-person questionnaire');

    const baselineVirtualResult = await testQuestionnaireManager.ensureTestQuestionnaire(
      'baseline',
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

  // Generate tests for each scenario
  for (const scenario of scenarios) {
    test(`${scenario.description}`, async ({ page }) => {
      // Select the appropriate test location based on visit type and service mode
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
      const { appointmentResponse, paperworkHelper } = await executeBookingScenario(page, scenario, locationName);

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
      if (shouldExtendWithReturningPatient(scenario, scenarios)) {
        await executeReturningPatientFlow(page, scenario, appointmentResponse);
      }
      if (shouldExtendWithModification(scenario, scenarios)) {
        await executeModificationFlow(page, appointmentResponse);
      }
      if (shouldExtendWithCancellation(scenario, scenarios)) {
        await executeCancellationFlow(page, appointmentResponse, scenario);
      }

      // Extended P2 coverage
      if (shouldExtendWithWaitingRoomParticipants(scenario, scenarios)) {
        await executeWaitingRoomParticipantsFlow(page);
      }
      if (shouldExtendWithPastVisits(scenario, scenarios)) {
        await executePastVisitsFlow(page, appointmentResponse);
      }
      if (shouldExtendWithReviewPageVerification(scenario, scenarios)) {
        await executeReviewPageVerification(
          page,
          appointmentResponse.appointmentId,
          scenario.serviceMode,
          paperworkHelper
        );
      }
    });
  }
});
