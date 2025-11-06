import { expect, Page } from '@playwright/test';
import { ApptTelemedTab } from 'utils';
import { dataTestIds } from '../../../../src/constants/data-test-ids';

export class TelemedTrackingBoardPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async awaitAppointmentsTableToBeLoaded(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.dashboard.loadingIndicator)).not.toBeVisible();
  }

  async expectAppointment(appointmentId: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(appointmentId))).toBeVisible({
      timeout: 20000,
    });
  }

  async clickAllPatientsTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.telemedEhrFlow.allPatientsButton).click();
  }

  async clickMyPatientsTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.telemedEhrFlow.myPatientsButton).click();
  }

  async openTab(tab: ApptTelemedTab): Promise<void> {
    await this.#page.getByTestId(dataTestIds.telemedEhrFlow.telemedAppointmentsTabs(tab)).click();
  }

  async clickAppointmentRow(appointmentId: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(appointmentId)).click();
  }
}

export async function expectTelemedTrackingBoard(page: Page): Promise<TelemedTrackingBoardPage> {
  await page.waitForURL(new RegExp('/telemed/appointments'));
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable)).toBeVisible();
  return new TelemedTrackingBoardPage(page);
}
