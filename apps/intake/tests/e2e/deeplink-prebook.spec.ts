/**
 * In-person prebook deeplink tests.
 * URL: /prebook/in-person?bookingOn={SLUG}&scheduleType=location
 *
 * Mirrors deeplink-walkin.spec.ts. Pins the behavior: when a scoped prebook
 * deeplink lands without a serviceCategory and the destination supports
 * multiple categories in the (in-person, prebook) context, PrebookVisit
 * redirects to the service-category picker rather than dumping the patient
 * into a categoryless booking flow. The redirect was added in response to a
 * production bug at /prebook/in-person?bookingOn=Commack-NY&scheduleType=
 * location where the missing redirect let booking proceed without a
 * category, then either back-compat-defaulted to urgent-care or surfaced
 * the "not bookable against a provider-owned schedule" rejection mid-flow.
 *
 * The test split on category-count mirrors the walk-in split — each
 * customer config asserts the behavior it actually produces, so the suite
 * is honest under any BOOKING_CONFIG shape rather than silently passing on
 * an unexpected one.
 */

import { expect, test } from '@playwright/test';
import { BOOKING_CONFIG, serviceCategorySupportsContext, SLUG_SYSTEM } from 'utils';
import { TestLocationManager } from '../utils/booking/TestLocationManager';

// How many BOOKING_CONFIG entries qualify as in-person + prebook capable
// under the running customer's config — same predicate PrebookVisit uses
// to decide between the picker redirect (2+) and the direct-landing
// fallback (<2). Splitting the test below on this number keeps the suite
// honest across any customer's catalog shape.
const INPERSON_PREBOOK_CAPABLE_COUNT = BOOKING_CONFIG.serviceCategories.filter((sc) =>
  serviceCategorySupportsContext({ ...sc, source: 'booking-config' }, 'in-person', 'prebook')
).length;

test.describe('Prebook deeplink flows', () => {
  let testLocationManager: TestLocationManager;
  let locationSlug: string;

  // Setup: Create a Location-actored prebook test schedule. The Location's
  // slug is what `bookingOn=` in the URL resolves through, so we pull it
  // off the persisted Location's identifier rather than reconstructing it
  // from the worker id (avoids drift if the fixture's slug derivation ever
  // changes).
  test.beforeAll(async () => {
    const shortTimestamp = Date.now().toString(36).slice(-6);
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const workerUniqueId = `pb-${shortTimestamp}${randomSuffix}`;
    console.log(`Prebook deeplink test worker unique ID: ${workerUniqueId}`);

    testLocationManager = new TestLocationManager(workerUniqueId);
    await testLocationManager.init();

    const { location } = await testLocationManager.ensurePrebookInPersonLocationWithSlots();
    const slugIdentifier = location.identifier?.find((id) => id.system === SLUG_SYSTEM)?.value;
    if (!slugIdentifier) {
      throw new Error(`Test location ${location.id} is missing a SLUG_SYSTEM identifier — fixture broken`);
    }
    locationSlug = slugIdentifier;
    console.log(`✓ Created prebook in-person location with slug: ${locationSlug}`);
  });

  test.afterAll(async () => {
    if (testLocationManager) {
      await testLocationManager.cleanup();
      console.log('✓ Cleaned up prebook deeplink test location and schedule');
    }
  });

  test('Deeplink without serviceCategory redirects to the service-category picker (multi-category configs)', async ({
    page,
  }) => {
    test.skip(
      INPERSON_PREBOOK_CAPABLE_COUNT < 2,
      `requires 2+ in-person + prebook capable BOOKING_CONFIG entries to exercise the picker; this config has ${INPERSON_PREBOOK_CAPABLE_COUNT}`
    );
    const deeplinkUrl = `/prebook/in-person?bookingOn=${locationSlug}&scheduleType=location`;
    console.log(`Navigating to prebook deeplink without serviceCategory: ${deeplinkUrl}`);

    await page.goto(deeplinkUrl, { waitUntil: 'networkidle' });

    // URL must acquire the picker suffix — preserving the original query
    // string so the picker can return the patient here with serviceCategory
    // appended.
    await expect(page).toHaveURL(/\/prebook\/in-person\/select-service-category/, { timeout: 20000 });
    console.log('✓ Redirected to service-category picker');

    // Time-slot buttons (rendered by PrebookVisit when slots load) must be
    // absent — confirms the redirect intercepted before the booking page
    // mounted, not after. If they were briefly visible, a fast patient
    // click could create a categoryless slot before the redirect fired.
    const timeButtons = page.locator('button.time-button');
    await expect(timeButtons).toHaveCount(0);
    console.log('✓ Time slot buttons absent on picker page');
  });

  test('Deeplink without serviceCategory lands directly on the booking page (single/zero-category configs)', async ({
    page,
  }) => {
    test.skip(
      INPERSON_PREBOOK_CAPABLE_COUNT >= 2,
      `applies only when <2 in-person + prebook capable BOOKING_CONFIG entries; this config has ${INPERSON_PREBOOK_CAPABLE_COUNT}`
    );
    // With fewer than 2 candidates the picker is skipped: PrebookVisit
    // renders the booking page directly with the single match (or no
    // category at all) flowing through create-slot's fallback. The URL
    // must NOT acquire the picker suffix.
    const deeplinkUrl = `/prebook/in-person?bookingOn=${locationSlug}&scheduleType=location`;
    console.log(`Navigating to prebook deeplink without serviceCategory: ${deeplinkUrl}`);

    await page.goto(deeplinkUrl, { waitUntil: 'networkidle' });

    // URL stays on the booking page — no `/select-service-category` suffix.
    // `:has-text` over `toHaveURL` because the URL also carries the booking-
    // page params we want to assert are intact.
    expect(page.url()).not.toContain('/select-service-category');
    expect(page.url()).toContain(`bookingOn=${locationSlug}`);
    expect(page.url()).toContain('scheduleType=location');
    console.log('✓ URL did not redirect to picker');

    // The "First available time" text is the booking page's slot-list
    // header — visible only once PrebookVisit's slot data has loaded.
    const firstAvailable = page.getByText('First available time');
    await expect(firstAvailable).toBeVisible({ timeout: 20000 });
    console.log('✓ First available time text visible — booking page rendered');
  });
});
