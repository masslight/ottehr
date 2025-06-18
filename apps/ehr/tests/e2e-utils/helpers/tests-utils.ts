import { expect, Locator, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export async function waitForSnackbar(page: Page): Promise<void> {
  // for this moment it's the easiest way to check for snackbar, data-key didn't work out
  const snackbar = page.locator('div[id=notistack-snackbar]');
  await expect(snackbar).toBeVisible();
}

export async function fetchWithOystehrAuth<T = any>(
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH',
  url: string,
  authToken: string,
  body?: any
): Promise<T> {
  const oystehrProjectId = process.env.PROJECT_ID;
  if (!oystehrProjectId) throw new Error('secret PROJECT_ID is not set');

  const response = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${authToken}`,
      'x-zapehr-project-id': oystehrProjectId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const res = await response.json();
    throw new Error(`HTTP error for ${method} ${url}: ${res}, ${JSON.stringify(res)}`);
  }
  console.log(`Request status for ${url}: `, response.status);

  if (response.body) {
    const data = await response.json();
    return data?.output ? data.output : data;
  }

  return {} as T;
}

export async function awaitAppointmentsTableToBeVisible(page: Page): Promise<void> {
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable)).toBeVisible();
  await expect(page.getByTestId(dataTestIds.dashboard.loadingIndicator)).not.toBeVisible();
}

export async function telemedDialogConfirm(page: Page): Promise<void> {
  const dialogButtonConfirm = page.getByTestId(dataTestIds.dialog.proceedButton);
  await expect(dialogButtonConfirm).toBeVisible();
  await dialogButtonConfirm.click();
}

export async function checkDropdownHasOptionAndSelectIt(
  page: Page,
  dropdownTestId: string,
  pattern: string
): Promise<void> {
  await page.getByTestId(dropdownTestId).locator('input').fill(pattern);

  const option = await getDropdownOption(page, pattern);
  if (option) {
    await expect(option).toBeVisible();
    await option.click();
  }
}

export async function getDropdownOption(page: Page, pattern: string): Promise<Locator> {
  return page.locator('[role="option"]', { hasText: new RegExp(pattern, 'i') }).first();
}
