import { expect, Page } from '@playwright/test';
import { TelemedAppointmentStatusEnum } from 'utils';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { telemedDialogConfirm } from './tests-utils';

export async function assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(
  page: Page,
  { forceWaitForAssignButton = false }: { forceWaitForAssignButton?: boolean } = {}
): Promise<void> {
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.appointmentChartFooter)).toBeVisible();
  const assignButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonAssignMe);
  if (forceWaitForAssignButton) {
    await expect(assignButton).toBeVisible();
  }
  // CHECK IF APPOINTMENT IS ASSIGNED ON ME AND ASSIGN IF NOT
  if (await assignButton.isVisible()) {
    await assignButton.click();

    await telemedDialogConfirm(page);

    const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
    await expect(statusChip).toBeVisible();
    // todo: is it ok to have check like this that rely on status text??
    await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['pre-video']);
  }
}

export async function waitForConnectToPatientButton(page: Page): Promise<void> {
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).toBeVisible();
}
