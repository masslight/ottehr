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
    await expect(visitLocator).toBeVisible({ timeout: 30000 });
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
      .click({ timeout: 25000 });
  }

  async clickVisitDetailsButton(appointmentId: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId))
      .getByTestId(dataTestIds.dashboard.visitDetailsButton)
      .click({ timeout: 25000 });
  }

  async clickProgressNoteButton(appointmentId: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId))
      .getByTestId(dataTestIds.dashboard.progressNoteButton)
      .click({ timeout: 25000 });
  }

  async clickArrivedButton(appointmentId: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId))
      .getByTestId(dataTestIds.dashboard.arrivedButton)
      .click({ timeout: 25000 });
  }

  async clickOnPatientName(appointmentId: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId))
      .getByTestId(dataTestIds.dashboard.patientName)
      .click({ timeout: 25000 });
  }

  async clickChatButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.chatButton).click({ timeout: 25000 });
  }

  async clickPrebookedTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.prebookedTab).click();
  }

  async clickInOfficeTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.inOfficeTab).click();
  }

  async clickDischargedTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.dischargedTab).click();
  }

  async clickCancelledTab(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.cancelledTab).click();
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
}

export async function expectVisitsPage(page: Page): Promise<VisitsPage> {
  await page.waitForURL(/visits/);
  return new VisitsPage(page);
}

export async function openVisitsPage(page: Page): Promise<VisitsPage> {
  await page.goto(`/visits`);
  return expectVisitsPage(page);
}
