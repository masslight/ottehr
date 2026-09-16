import { BrowserContext, Page, test } from '@playwright/test';
import { isLocationVirtual } from 'utils/lib/fhir/location';
import locationsSpec from '../../../../../../config/runtime-seed/locations-and-schedules.json';
import {
  expectLocationDetailPage,
  expectLocationsAdminPage,
  LocationDetailPage,
  LocationsAdminPage,
} from '../../page/LocationsAdminPage';
import { adminSidebarItem } from '../../utils/adminNav';

function findFirstLocationName(): string {
  const entries = Object.values((locationsSpec as { fhirResources: Record<string, any> }).fhirResources);
  let inPerson: string | undefined;
  let telemed: string | undefined;
  for (const entry of entries) {
    const resource = entry.resource;
    if (resource?.resourceType !== 'Location' || !resource.name) continue;
    if (isLocationVirtual(resource)) {
      telemed ??= resource.name;
    } else {
      inPerson ??= resource.name;
    }
  }
  if (inPerson) return inPerson;
  if (telemed) return telemed;
  throw new Error(
    'Expected locations-and-schedules.json to contain at least one named Location resource, but none were found.'
  );
}

let page: Page;
let context: BrowserContext;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.close();
  await context.close();
});

let locationsAdminPage: LocationsAdminPage;
let detailPage: LocationDetailPage;
// Fallback derived from IaC config; overridden at runtime with a location that is actually
// present in the deployed test data (the config and the deployed env can diverge).
let TARGET_LOCATION = findFirstLocationName();

test.describe.configure({ mode: 'serial' });

test.describe('Locations Admin', () => {
  test('open Locations admin panel and verify table loads', async () => {
    await page.goto('/admin/locations');
    locationsAdminPage = await expectLocationsAdminPage(page);
  });

  test('verify locations are listed and target location exists', async () => {
    const rowCount = await locationsAdminPage.getLocationRows();
    test.skip(rowCount === 0, 'No locations available to test');

    // Use a (named) location actually rendered in the table rather than one derived from
    // the IaC config, which may not match what's seeded in the CI environment. The list can
    // include unnamed locations (shown as "-"), so pick the first row with a real name.
    TARGET_LOCATION = await locationsAdminPage.getFirstNamedLocationName();

    await locationsAdminPage.searchLocations(TARGET_LOCATION);
    await locationsAdminPage.verifyLocationVisible(TARGET_LOCATION);
    await locationsAdminPage.searchLocations('');
  });

  test('search filters locations correctly', async () => {
    await locationsAdminPage.searchLocations(TARGET_LOCATION);
    await locationsAdminPage.verifyLocationVisible(TARGET_LOCATION);

    // Search for nonexistent location
    await locationsAdminPage.searchLocations('ZZZZNONEXISTENT');
    await locationsAdminPage.verifyLocationNotVisible(TARGET_LOCATION);

    // Clear search
    await locationsAdminPage.searchLocations('');
  });

  test('click on a location row navigates to detail page', async () => {
    await locationsAdminPage.searchLocations(TARGET_LOCATION);
    await locationsAdminPage.clickLocationByName(TARGET_LOCATION);
    detailPage = await expectLocationDetailPage(page);
  });

  test('detail page shows location name and sections', async () => {
    test.skip(!detailPage, 'Detail page not loaded');

    await detailPage.verifyLocationName(TARGET_LOCATION);
    await detailPage.verifyAddressAndContactSections();
    await detailPage.verifyBreadcrumbs();
  });

  test('clicking breadcrumb returns to locations list', async () => {
    test.skip(!detailPage, 'Detail page not loaded');

    await detailPage.clickLocationsBreadcrumb();
    locationsAdminPage = await expectLocationsAdminPage(page);
  });

  test('sidebar navigation to and from Locations works', async () => {
    // Locations now lives in the admin "Practice" group; round-trip via the sidebar
    // against a sibling item (Services).
    await page.goto('/admin/services');
    await page.waitForLoadState('networkidle');

    // Click Locations sidebar item
    await adminSidebarItem(page, '/admin/locations').click();
    await page.waitForURL('**/admin/locations');
    locationsAdminPage = await expectLocationsAdminPage(page);

    // Click Services sidebar item
    await adminSidebarItem(page, '/admin/services').click();
    await page.waitForURL('**/admin/services');

    // Click back to Locations
    await adminSidebarItem(page, '/admin/locations').click();
    await page.waitForURL('**/admin/locations');
  });
});
