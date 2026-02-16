/**
 * Example: Complete Booking + Paperwork Flow
 *
 * This demonstrates how to use the integrated booking and paperwork system.
 * Shows how scenarios automatically include paperwork configs.
 */

import { describe, it } from 'vitest';
import { generateBookingTestScenarios } from '../utils/booking/BookingTestFactory';

describe('Complete Booking + Paperwork Flow Example', () => {
  it('demonstrates scenario generation with paperwork configs', () => {
    // Generate all test scenarios from baseline config
    const scenarios = generateBookingTestScenarios('baseline');

    console.log('\n=== Generated Booking Scenarios with Paperwork Configs ===\n');

    scenarios.forEach((scenario, index) => {
      console.log(`Scenario ${index + 1}:`);
      console.log(`  Description: ${scenario.description}`);
      console.log(`  Service Mode: ${scenario.serviceMode}`);
      console.log(`  Visit Type: ${scenario.visitType}`);
      console.log(`  Service Category: ${scenario.serviceCategory}`);
      console.log(`  Paperwork Config: ${scenario.paperworkConfig}`);
      console.log('');
    });

    console.log(`Total scenarios: ${scenarios.length}`);
    console.log('\nEach scenario now includes automatic paperwork completion!');
    console.log('\nMapping Strategy:');
    console.log('  - Urgent care in-person walk-in  → baseline-in-person (full form)');
    console.log('  - Urgent care in-person prebook  → required-only-in-person (quick)');
    console.log('  - Urgent care virtual walk-in    → baseline-virtual (with history)');
    console.log('  - Urgent care virtual prebook    → minimal-virtual (no history)');
    console.log('  - Workers comp (any)             → workers-comp-in-person');
    console.log('  - Occ med (any)                  → occ-med-in-person');
  });

  it('shows how to use in actual test', () => {
    const scenarios = generateBookingTestScenarios('baseline');
    const exampleScenario = scenarios[0];

    console.log('\n=== Using in Playwright Test ===\n');
    console.log('test.describe(`Booking flow: ${scenario.description}`, () => {');
    console.log('  test("complete booking and paperwork", async ({ page }) => {');
    console.log('    const config = createBookingConfigForTest(scenario.configName);');
    console.log('');
    console.log('    // Execute booking + paperwork in one call');
    console.log('    const result = await executeBookingScenario(');
    console.log('      page,');
    console.log('      scenario,  // Includes paperworkConfig!');
    console.log('      config,');
    console.log('      testLocationName,');
    console.log('      scenario.paperworkConfig  // Or override here');
    console.log('    );');
    console.log('');
    console.log('    // Result contains appointment data');
    console.log('    expect(result.appointmentId).toBeDefined();');
    console.log('  });');
    console.log('});');
    console.log('');
    console.log(`Example scenario would use: ${exampleScenario.paperworkConfig}`);
  });
});
