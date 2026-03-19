import { BrowserContext, expect, Page, test } from '@playwright/test';

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

test.describe.configure({ mode: 'serial' });

test.describe('Provider KPIs Report', () => {
  test('Reports page shows the Provider KPIs tile', async () => {
    await page.goto('/reports');

    // The page heading
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 15000 });

    // The tile should be present
    await expect(page.getByText('Provider KPIs', { exact: true })).toBeVisible();
  });

  test('Clicking Provider KPIs tile navigates to the report page', async () => {
    await page.goto('/reports');

    // Click the tile
    await page.getByText('Provider KPIs', { exact: true }).click();

    // Should navigate to the correct URL
    await expect(page).toHaveURL('/reports/provider-kpis');
  });

  test('Provider KPIs report page renders heading and description', async () => {
    await page.goto('/reports/provider-kpis');

    // Heading
    await expect(page.getByRole('heading', { name: 'Provider KPIs' })).toBeVisible({ timeout: 15000 });

    // Description text
    await expect(page.getByText(/E&M coding distribution by attending provider/i)).toBeVisible();
  });

  test('Date range selector is visible and defaults to Last 7 Days', async () => {
    await page.goto('/reports/provider-kpis');

    // The date range combobox should be present
    const dateRangeSelect = page.getByRole('combobox');
    await expect(dateRangeSelect).toBeVisible({ timeout: 15000 });

    // Default value should be "Last 7 Days"
    await expect(dateRangeSelect).toContainText('Last 7 Days');
  });

  test('Selecting Custom Date Range shows start and end date inputs', async () => {
    await page.goto('/reports/provider-kpis');

    // Open the date range dropdown
    await page.getByRole('combobox').click();

    // Select "Custom Date Range"
    await page.getByRole('option', { name: 'Custom Date Range' }).click();

    // Both date pickers should now be visible
    await expect(page.getByLabel('Start Date')).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel('End Date')).toBeVisible({ timeout: 5000 });
  });

  test('Selecting Custom Date shows a single date input', async () => {
    await page.goto('/reports/provider-kpis');

    // Open the date range dropdown
    await page.getByRole('combobox').click();

    // Select "Custom Date"
    await page.getByRole('option', { name: 'Custom Date', exact: true }).click();

    // Start Date / End Date should NOT be visible — a single date input should appear
    await expect(page.getByLabel('Start Date')).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByLabel('End Date')).not.toBeVisible({ timeout: 3000 });

    // Single date input (unlabeled date field) should be present
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible({ timeout: 5000 });
  });

  test('Refresh button is present and clickable', async () => {
    await page.goto('/reports/provider-kpis');

    const refreshButton = page.getByRole('button', { name: /Refresh/i });
    await expect(refreshButton).toBeVisible({ timeout: 15000 });
    await expect(refreshButton).toBeEnabled();

    // Click should not throw
    await refreshButton.click();
  });

  test('Back button navigates to the reports index', async () => {
    await page.goto('/reports/provider-kpis');

    // The back arrow button
    const backButton = page.locator('[data-testid="ArrowBackIcon"]').locator('..');
    await expect(backButton).toBeVisible({ timeout: 15000 });
    await backButton.click();

    await expect(page).toHaveURL('/reports');
  });
});
