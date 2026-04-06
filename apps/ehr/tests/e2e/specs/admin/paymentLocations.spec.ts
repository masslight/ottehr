import { BrowserContext, Page, test } from '@playwright/test';
import { LOCATION_CONFIG } from 'utils/lib/ottehr-config/locations/index';
import {
  expectPaymentLocationDetailPage,
  expectPaymentLocationsPage,
  PaymentLocationDetailPage,
  PaymentLocationsPage,
} from '../../page/PaymentLocationsPage';

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

let paymentLocationsPage: PaymentLocationsPage;
let detailPage: PaymentLocationDetailPage;
const TARGET_LOCATION = LOCATION_CONFIG.inPersonLocations[0]?.name || LOCATION_CONFIG.telemedLocations[0]?.name;

test.describe.configure({ mode: 'serial' });

test.describe('Payment Locations Admin', () => {
  test('open Payment Locations tab from billing and verify table loads', async () => {
    await page.goto('/admin/billing/payment-locations');
    paymentLocationsPage = await expectPaymentLocationsPage(page);
    await paymentLocationsPage.verifyPaginationDisplayed();
  });

  test('verify locations are listed and target location exists', async () => {
    const rowCount = await paymentLocationsPage.getLocationRows();
    test.skip(rowCount === 0, 'No payment locations available to test');

    await paymentLocationsPage.searchLocations(TARGET_LOCATION);
    await paymentLocationsPage.verifyLocationVisible(TARGET_LOCATION);
    await paymentLocationsPage.searchLocations('');
  });

  test('search filters locations correctly', async () => {
    await paymentLocationsPage.searchLocations(TARGET_LOCATION);
    await paymentLocationsPage.verifyLocationVisible(TARGET_LOCATION);

    // Search for nonexistent location
    await paymentLocationsPage.searchLocations('ZZZZNONEXISTENT');
    await paymentLocationsPage.verifyLocationNotVisible(TARGET_LOCATION);

    // Clear search
    await paymentLocationsPage.searchLocations('');
  });

  test('click on a location row navigates to detail page', async () => {
    await paymentLocationsPage.searchLocations(TARGET_LOCATION);
    await paymentLocationsPage.clickLocationByName(TARGET_LOCATION);
    detailPage = await expectPaymentLocationDetailPage(page);
  });

  test('detail page shows location name and sections', async () => {
    test.skip(!detailPage, 'Detail page not loaded');

    await detailPage.verifyLocationName(TARGET_LOCATION);
    await detailPage.verifyContactAndAddressSection();
    await detailPage.verifyBreadcrumbs();
  });

  test('clicking breadcrumb returns to locations list', async () => {
    test.skip(!detailPage, 'Detail page not loaded');

    await detailPage.clickPaymentLocationsBreadcrumb();
    paymentLocationsPage = await expectPaymentLocationsPage(page);
  });

  test('tab navigation between billing sub-tabs works', async () => {
    await page.goto('/admin/billing/fee-schedules');
    await page.waitForLoadState('networkidle');

    // Click Payment Locations tab
    await page.getByRole('tab', { name: /payment locations/i }).click();
    await page.waitForURL('**/billing/payment-locations');
    paymentLocationsPage = await expectPaymentLocationsPage(page);

    // Click Fee Schedules tab
    await page.getByRole('tab', { name: /fee schedules/i }).click();
    await page.waitForURL('**/billing/fee-schedules');

    // Click back to Payment Locations
    await page.getByRole('tab', { name: /payment locations/i }).click();
    await page.waitForURL('**/billing/payment-locations');
  });
});
