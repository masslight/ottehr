import { expect, Locator, Page } from '@playwright/test';
import { DocumentReference } from 'fhir/r4b';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { ResourceHandler } from '../resource-handler';

export async function waitForSnackbar(page: Page): Promise<void> {
  // for this moment it's the easiest way to check for snackbar, data-key didn't work out
  const snackbar = page.locator('div[id=notistack-snackbar]');
  await expect(snackbar).toBeVisible();
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

export async function hideTooltip(page: Page, timeout = 2000): Promise<void> {
  await page.mouse.move(0, 0);

  const tooltip = page.locator('[role="tooltip"]');
  await expect(tooltip).toHaveCount(0, { timeout });
}

export function verifyVisitNotePdfDocumentReference(
  visitNoteDocRef: DocumentReference,
  resourceHandler: ResourceHandler
): void {
  expect(visitNoteDocRef.type?.coding?.[0]?.code).toBe('75498-6');
  expect(visitNoteDocRef.type?.coding?.[0]?.display).toBe('Visit details');
  expect(visitNoteDocRef.type?.text).toBe('Visit details');
  expect(visitNoteDocRef.subject?.reference).toBe(`Patient/${resourceHandler.patient.id}`);
  expect(visitNoteDocRef.context?.encounter?.[0]?.reference).toBe(`Encounter/${resourceHandler.encounter.id}`);
  expect(visitNoteDocRef.context?.related?.[0]?.reference).toBe(`Appointment/${resourceHandler.appointment.id}`);
  expect(visitNoteDocRef.content?.[0]?.attachment?.url).toBeDefined();
}
