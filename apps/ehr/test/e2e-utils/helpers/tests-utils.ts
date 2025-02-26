import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export async function waitForSnackbar(page: Page): Promise<void> {
  // for this moment it's the easiest way to check for snackbar, data-key didn't work out
  const snackbar = page.locator('div[id=notistack-snackbar]');
  await expect(snackbar).toBeVisible();
}

export async function fetchWithOystAuth<T = any>(
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH',
  url: string,
  authToken: string,
  body?: any
): Promise<T> {
  const oyst_proj_id = process.env.PROJECT_ID;
  if (!oyst_proj_id) throw new Error('secret PROJECT_ID is not set');

  const response = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${authToken}`,
      'x-zapehr-project-id': oyst_proj_id,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const res = await response.json();
    throw new Error(`HTTP error for ${method} ${url}: ${res}, ${JSON.stringify(res)}`);
  }
  console.log(`Request status for ${url}: `, response.status);
  return response.body ? await response.json() : {};
}

export async function awaitAppointmentsTableToBeVisible(page: Page): Promise<void> {
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable)).toBeVisible();
  await expect(page.getByTestId(dataTestIds.dashboard.loadingIndicator)).not.toBeVisible();
}

export async function telemedDialogConfirm(page: Page): Promise<void> {
  const dialogButtonConfirm = page.getByTestId(dataTestIds.telemedEhrFlow.dialogButtonConfirm);
  await expect(dialogButtonConfirm).toBeVisible();
  await dialogButtonConfirm.click();
}
