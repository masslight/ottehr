import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class VisitsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyVisitPresent(appointmentId: string, time?: string): Promise<void> {
    let visitLocator = this.#page.getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId));
    if (time) {
      visitLocator = visitLocator.filter({ hasText: time });
    }
    await expect(visitLocator).toBeVisible();
  }

  async verifyVisitsStatus(appointmentId: string, visitStatus: string): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId))
        .getByTestId(dataTestIds.dashboard.appointmentStatus)
    ).toHaveText(visitStatus);
  }

  async clickIntakeButton(appointmentId: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId))
      .getByTestId(dataTestIds.dashboard.intakeButton)
      .click();
  }

  async clickArrivedButton(appointmentId: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId))
      .getByTestId(dataTestIds.dashboard.arrivedButton)
      .click();
  }

  async clickChatButton(appointmentId: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.chatButton).click();
  }

  async clickPrebookedTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.prebookedTab).click();
    await this.#page.waitForTimeout(15000);
  }

  async clickInOfficeTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.inOfficeTab).click();
    await this.#page.waitForTimeout(15000);
  }

  async clickDischargedTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.dischargedTab).click();
    await this.#page.waitForTimeout(15000);
  }

  async clickCancelledTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.cancelledTab).click();
    await this.#page.waitForTimeout(15000);
  }

  async selectLocation(locationName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.locationSelect).click();
    await this.#page.locator(`li[role="option"]:has-text("${locationName}")`).first().click();
  }

  async selectGroup(groupName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.groupSelect).click();
    await this.#page.getByText(new RegExp(groupName, 'i')).click();
  }

  async clickAddPatientButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.addPatientButton).click();
  }

  async clickOnVisit(appointmentId: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId)).click();
  }
}

export async function expectVisitsPage(page: Page): Promise<VisitsPage> {
  await page.waitForURL(/visits/);
  return new VisitsPage(page);
}

export async function openVisitsPage(page: Page): Promise<VisitsPage> {
  await page.goto(`/visits`);
  return expectVisitsPage(page);
}
