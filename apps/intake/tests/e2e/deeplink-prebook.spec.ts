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
  let locationName: string;
  let groupName: string;

  // Setup: Create a Location-actored prebook test schedule AND a Group
  // (HealthcareService) booking fixture. Both are needed because the
  // picker-filter tests below assert what the dropdown surfaces when the URL
  // has scheduleType absent vs. =group — we have to have both types of
  // bookable entity in play for either assertion to be meaningful (a
  // "Locations only" assertion is trivially true if no Group exists). The
  // Location's slug is what `bookingOn=` in the URL resolves through, so we
  // pull it off the persisted Location's identifier rather than
  // reconstructing it from the worker id (avoids drift if the fixture's
  // slug derivation ever changes).
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
    if (!location.name) {
      throw new Error(`Test location ${location.id} is missing a name — fixture broken`);
    }
    locationName = location.name;
    console.log(`✓ Created prebook in-person location with slug: ${locationSlug}`);

    const groupFixture = await testLocationManager.ensurePrebookInPersonGroupWithSlots();
    if (!groupFixture.healthcareService.name) {
      throw new Error(`Test group ${groupFixture.healthcareService.id} is missing a name — fixture broken`);
    }
    groupName = groupFixture.healthcareService.name;
    console.log(`✓ Created prebook in-person group: ${groupName}`);
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

    // URL must acquire the picker suffix AND preserve the original query
    // string. The query-string preservation is load-bearing: the picker's
    // round-trip back here happens by stripping `/select-service-category`
    // from the path and re-using the existing query string with
    // `serviceCategory=<code>` appended. If the redirect dropped
    // `bookingOn`/`scheduleType` we'd land on the unscoped booking flow
    // after the patient picks, silently losing the original booking target
    // — exactly the kind of silent regression a pathname-only assertion
    // would miss.
    await expect(page).toHaveURL(/\/prebook\/in-person\/select-service-category/, { timeout: 20000 });
    const pickerUrl = new URL(page.url());
    expect(pickerUrl.searchParams.get('bookingOn')).toBe(locationSlug);
    expect(pickerUrl.searchParams.get('scheduleType')).toBe('location');
    console.log('✓ Redirected to service-category picker with query string preserved');

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

    // URL stays on the booking page — no `/select-service-category` suffix —
    // and the original query params survive. Parsing via URL + searchParams
    // rather than substring-matching avoids false positives if the suffix
    // ever ends up inside a query value, and gives a per-param assertion
    // failure rather than a single opaque "URL didn't match" if anything
    // changes shape.
    const landedUrl = new URL(page.url());
    expect(landedUrl.pathname).toBe('/prebook/in-person');
    expect(landedUrl.searchParams.get('bookingOn')).toBe(locationSlug);
    expect(landedUrl.searchParams.get('scheduleType')).toBe('location');
    console.log('✓ URL did not redirect to picker');

    // The "First available time" text is the booking page's slot-list
    // header — visible only once PrebookVisit's slot data has loaded.
    const firstAvailable = page.getByText('First available time');
    await expect(firstAvailable).toBeVisible({ timeout: 20000 });
    console.log('✓ First available time text visible — booking page rendered');
  });

  // Picker-filter tests. Production users have bookmarked /prebook URLs that
  // predate Groups as a bookable entity; those URLs landed on a Location-only
  // picker. After Groups were added to list-bookables' in-person response,
  // those bookmarks would have silently started surfacing Groups alongside
  // Locations unless the front end filtered. These tests pin the filter so a
  // future refactor can't reintroduce the regression.
  test('Picker without scheduleType param shows only Locations (back-compat default)', async ({ page }) => {
    await page.goto('/prebook/in-person', { waitUntil: 'networkidle' });

    // Open the Autocomplete dropdown — MUI renders the input as combobox
    // and the dropdown items as option role. Generic role selectors keep
    // the test from depending on internal test-id imports.
    const combobox = page.getByRole('combobox').first();
    await combobox.click();
    await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 20000 });

    const optionTexts = await page.getByRole('option').allTextContents();
    console.log(`Picker options (no scheduleType): ${JSON.stringify(optionTexts)}`);

    const hasLocation = optionTexts.some((t) => t.includes(locationName));
    const hasGroup = optionTexts.some((t) => t.includes(groupName));
    expect(hasLocation).toBe(true);
    expect(hasGroup).toBe(false);
    console.log('✓ Picker showed Location but not Group');
  });

  test('Picker with scheduleType=group shows only Groups (symmetric)', async ({ page }) => {
    await page.goto('/prebook/in-person?scheduleType=group', { waitUntil: 'networkidle' });

    const combobox = page.getByRole('combobox').first();
    await combobox.click();
    await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 20000 });

    const optionTexts = await page.getByRole('option').allTextContents();
    console.log(`Picker options (scheduleType=group): ${JSON.stringify(optionTexts)}`);

    const hasLocation = optionTexts.some((t) => t.includes(locationName));
    const hasGroup = optionTexts.some((t) => t.includes(groupName));
    expect(hasGroup).toBe(true);
    expect(hasLocation).toBe(false);
    console.log('✓ Picker showed Group but not Location');
  });
});
