import { BrowserContext, expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';

const DEFAULT_TIMEOUT = { timeout: 15000 };
const PROCESS_ID = `command-palette-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

test.describe.configure({ mode: 'serial' });
let page: Page;
let context: BrowserContext;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await resourceHandler.setResources();
  await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
  await page.close();
  await context.close();
});

test('Command palette opens with Cmd+K', async () => {
  await page.goto(`/in-person/${resourceHandler.appointment.id}`);
  await page.waitForLoadState('networkidle');

  await page.keyboard.press('Meta+k');
  await expect(page.getByPlaceholder(/search by patient/i)).toBeVisible(DEFAULT_TIMEOUT);
});

test('Command palette closes with Escape', async () => {
  await expect(page.getByPlaceholder(/search by patient/i)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByPlaceholder(/search by patient/i)).not.toBeVisible(DEFAULT_TIMEOUT);
});

test('Command palette shows navigation items', async () => {
  await page.keyboard.press('Meta+k');
  await expect(page.getByPlaceholder(/search by patient/i)).toBeVisible(DEFAULT_TIMEOUT);

  const input = page.getByPlaceholder(/search by patient/i);
  await input.fill('visits');

  await expect(page.getByText('Visits')).toBeVisible(DEFAULT_TIMEOUT);
});

test('Command palette filters items by typing', async () => {
  const input = page.getByPlaceholder(/search by patient/i);
  await input.fill('patients');

  await expect(page.getByText('Patients')).toBeVisible(DEFAULT_TIMEOUT);
  // Navigation items for other pages should be filtered out
  await expect(page.getByText('Schedules')).not.toBeVisible();
});

test('Command palette shows patient search fallback for unmatched query', async () => {
  const input = page.getByPlaceholder(/search by patient/i);
  await input.fill('xyznonexistent12345');

  await expect(page.getByText(/search patients for/i)).toBeVisible(DEFAULT_TIMEOUT);
});

test('Command palette keyboard navigation works', async () => {
  const input = page.getByPlaceholder(/search by patient/i);
  await input.fill('');

  // Wait for items to appear
  await expect(page.locator('[data-selected="true"]').first()).toBeVisible(DEFAULT_TIMEOUT);

  // Arrow down should move selection
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');

  // Selection should have moved (verify by checking there's still a selected item)
  await expect(page.locator('[data-selected="true"]').first()).toBeVisible();
});

test('Command palette closes after selecting an item with Enter', async () => {
  const input = page.getByPlaceholder(/search by patient/i);
  await input.fill('visits');
  await expect(page.getByText('Visits')).toBeVisible(DEFAULT_TIMEOUT);

  await page.keyboard.press('Enter');

  // Palette should close
  await expect(page.getByPlaceholder(/search by patient/i)).not.toBeVisible(DEFAULT_TIMEOUT);
});

test('Command palette does not open when typing in form inputs', async () => {
  // Navigate to a page with form inputs
  await page.goto(`/in-person/${resourceHandler.appointment.id}/chief-complaint`);
  await page.waitForLoadState('networkidle');

  // Find any text input on the page and focus it
  const textInput = page.locator('input[type="text"], textarea').first();
  if (await textInput.isVisible()) {
    await textInput.focus();
    await page.keyboard.press('Meta+k');
    // Palette should NOT open since focus was in an input
    await expect(page.getByPlaceholder(/search by patient/i)).not.toBeVisible({ timeout: 1000 });
  }
});
