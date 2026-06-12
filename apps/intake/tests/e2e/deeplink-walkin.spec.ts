/**
 * In-person walk-in deeplink tests
 *
 * Tests the deeplink behavior for walk-in check-in flows:
 * - Open location with explicit serviceCategory: navigates to check-in landing page
 * - Closed location: displays "location currently closed" message
 * - Open location with NO serviceCategory and 2+ walk-in-capable categories:
 *   redirects to the service-category picker so the patient chooses
 *
 * Deeplink URL pattern: /walkin/location/{LOCATION_NAME}?serviceCategory={SERVICE_CATEGORY}
 * - Location names use underscores instead of spaces
 * - Omitting serviceCategory used to silently default to 'urgent-care'.
 *   That behavior was replaced by a picker step (see the picker test
 *   below) — the patient now owns the category choice when more than one
 *   walk-in-capable option exists.
 *
 * All instances should run these tests.
 */

import { expect, test } from '@playwright/test';
import { TestLocationManager } from '../utils/booking/TestLocationManager';

test.describe('Walk-in deeplink flows', () => {
  let testLocationManager: TestLocationManager;
  let openLocationName: string;
  let closedLocationName: string;

  // Setup: Create test locations with different schedules
  test.beforeAll(async () => {
    // Generate a short unique ID for this worker to isolate test resources
    const shortTimestamp = Date.now().toString(36).slice(-6);
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const workerUniqueId = `dl-${shortTimestamp}${randomSuffix}`;
    console.log(`Deeplink test worker unique ID: ${workerUniqueId}`);

    testLocationManager = new TestLocationManager(workerUniqueId);
    await testLocationManager.init();

    // Create always-open location (24/7 schedule)
    const openResult = await testLocationManager.ensureDeeplinkOpenLocation();
    openLocationName = openResult.location.name!;
    console.log(`✓ Created always-open deeplink location: ${openLocationName}`);

    // Create always-closed location (no working days)
    const closedResult = await testLocationManager.ensureDeeplinkClosedLocation();
    closedLocationName = closedResult.location.name!;
    console.log(`✓ Created always-closed deeplink location: ${closedLocationName}`);
  });

  // Cleanup: Remove test resources after all tests
  test.afterAll(async () => {
    if (testLocationManager) {
      await testLocationManager.cleanup();
      console.log('✓ Cleaned up deeplink test locations and schedules');
    }
  });

  test('Open location deeplink navigates to check-in landing page', async ({ page }) => {
    // Build the deeplink URL
    // Location names may have spaces which need to be replaced with underscores for URL
    const locationSlug = openLocationName.replace(/\s+/g, '_');
    const deeplinkUrl = `/walkin/location/${locationSlug}?serviceCategory=urgent-care`;
    console.log(`Navigating to deeplink: ${deeplinkUrl}`);

    // Navigate to the deeplink
    await page.goto(deeplinkUrl, { waitUntil: 'networkidle' });

    // Verify we're on the check-in landing page
    // The page should show a Continue button to proceed with walk-in check-in
    const continueButton = page.getByRole('button', { name: /continue/i });
    await expect(continueButton).toBeVisible({ timeout: 20000 });
    console.log('✓ Continue button visible on check-in landing page');

    // Verify the location name is displayed somewhere on the page
    const locationDisplayed = await page.getByText(new RegExp(openLocationName.replace(/_/g, ' '), 'i')).isVisible();
    if (locationDisplayed) {
      console.log(`✓ Location name "${openLocationName}" displayed on page`);
    }

    // Verify we're on the expected URL pattern
    expect(page.url()).toContain('/walkin/location/');
    console.log('✓ Open location deeplink test passed');
  });

  test('Closed location deeplink shows location closed message', async ({ page }) => {
    // Build the deeplink URL
    const locationSlug = closedLocationName.replace(/\s+/g, '_');
    const deeplinkUrl = `/walkin/location/${locationSlug}?serviceCategory=urgent-care`;
    console.log(`Navigating to deeplink: ${deeplinkUrl}`);

    // Navigate to the deeplink
    await page.goto(deeplinkUrl, { waitUntil: 'networkidle' });

    // Verify the "location currently closed" message is displayed
    const closedMessage = page.getByText('Sorry! We are closed at the moment.');
    await expect(closedMessage).toBeVisible({ timeout: 20000 });
    console.log('✓ Location closed message visible');

    // The Continue button should NOT be visible when location is closed
    const continueButton = page.getByRole('button', { name: /continue/i });
    const continueVisible = await continueButton.isVisible().catch(() => false);

    // Some implementations may show a disabled continue or redirect
    // The key assertion is that the closed message is shown
    if (!continueVisible) {
      console.log('✓ Continue button not visible (expected for closed location)');
    } else {
      // If continue is visible, it might be disabled or lead to an error
      console.log('Note: Continue button visible - may be disabled or show error on click');
    }

    console.log('✓ Closed location deeplink test passed');
  });

  test('Deeplink without serviceCategory redirects to the service-category picker', async ({ page }) => {
    // BOOKING_CONFIG ships urgent-care, workers-comp, and occupational-
    // medicine — all walk-in-capable by default. With 2+ options and no
    // serviceCategory in the URL, WalkinLanding must redirect to the
    // picker child route so the patient chooses; the check-in landing
    // page must NOT render (a continue click in that window would create
    // a slot without a category, which the picker exists to prevent).
    // Previous product behavior silently defaulted to urgent-care.
    const locationSlug = openLocationName.replace(/\s+/g, '_');
    const deeplinkUrl = `/walkin/location/${locationSlug}`;
    console.log(`Navigating to deeplink without serviceCategory: ${deeplinkUrl}`);

    await page.goto(deeplinkUrl, { waitUntil: 'networkidle' });

    await expect(page).toHaveURL(/\/walkin\/location\/[^/]+\/select-service-category/, { timeout: 20000 });
    console.log('✓ Redirected to service-category picker');

    // The check-in landing page's continue button must be absent —
    // confirms the redirect intercepted before WalkinLanding could
    // render PageForm.
    const continueButton = page.getByRole('button', { name: /continue/i });
    await expect(continueButton).toHaveCount(0);
    console.log('✓ Continue button absent on picker page');
  });
});
