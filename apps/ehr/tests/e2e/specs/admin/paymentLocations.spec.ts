import { BrowserContext, Page, test } from '@playwright/test';
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
let firstLocationName: string;

test.describe.configure({ mode: 'serial' });

test.describe('Payment Locations Admin', () => {
  test('open Payment Locations tab from billing and verify table loads', async () => {
    await page.goto('/admin/billing/payment-locations');
    paymentLocationsPage = await expectPaymentLocationsPage(page);
    await paymentLocationsPage.verifyPaginationDisplayed();
  });

  test('verify locations are listed and get first location name', async () => {
    const rowCount = await paymentLocationsPage.getLocationRows();
    test.skip(rowCount === 0, 'No payment locations available to test');

    firstLocationName = await paymentLocationsPage.getFirstLocationName();
    await paymentLocationsPage.verifyLocationVisible(firstLocationName);
  });

  test('search filters locations correctly', async () => {
    test.skip(!firstLocationName, 'No locations available');

    await paymentLocationsPage.searchLocations(firstLocationName);
    await paymentLocationsPage.verifyLocationVisible(firstLocationName);

    // Search for nonexistent location
    await paymentLocationsPage.searchLocations('ZZZZNONEXISTENT');
    await paymentLocationsPage.verifyLocationNotVisible(firstLocationName);

    // Clear search
    await paymentLocationsPage.searchLocations('');
  });

  test('click on a location row navigates to detail page', async () => {
    test.skip(!firstLocationName, 'No locations available');

    await paymentLocationsPage.searchLocations(firstLocationName);
    await paymentLocationsPage.clickLocationByName(firstLocationName);
    detailPage = await expectPaymentLocationDetailPage(page);
  });

  test('detail page shows location name and sections', async () => {
    test.skip(!detailPage, 'Detail page not loaded');

    await detailPage.verifyLocationName(firstLocationName);
    await detailPage.verifyContactAndAddressSection();
    await detailPage.verifyBackButton();
  });

  test('clicking back button returns to locations list', async () => {
    test.skip(!detailPage, 'Detail page not loaded');

    await detailPage.clickBackButton();
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
