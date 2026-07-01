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
    const intakeButton = this.#page
      .getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId))
      .getByTestId(dataTestIds.dashboard.intakeButton);
    await intakeButton.waitFor({ state: 'visible', timeout: 60000 });
    await intakeButton.click();
  }

  async clickReadyButton(appointmentId: string): Promise<void> {
    const readyButton = this.#page
      .getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId))
      .getByTestId(dataTestIds.dashboard.readyButton);
    await readyButton.waitFor({ state: 'visible', timeout: 60000 });
    await readyButton.click();
  }

  async clickVisitDetailsButton(appointmentId: string): Promise<void> {
    const visitDetailsButton = this.#page
      .getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId))
      .getByTestId(dataTestIds.dashboard.visitDetailsButton);
    await visitDetailsButton.waitFor({ state: 'visible', timeout: 60000 });
    await visitDetailsButton.click();
  }

  async clickProgressNoteButton(appointmentId: string): Promise<void> {
    const progressNoteButton = this.#page
      .getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId))
      .getByTestId(dataTestIds.dashboard.progressNoteButton);
    await progressNoteButton.waitFor({ state: 'visible', timeout: 60000 });
    await progressNoteButton.click();
  }

  async clickArrivedButton(appointmentId: string): Promise<void> {
    const arrivedButton = this.#page
      .getByTestId(dataTestIds.dashboard.tableRowWrapper(appointmentId))
      .getByTestId(dataTestIds.dashboard.arrivedButton);
    // Wait for button to be visible and enabled before clicking
    await arrivedButton.waitFor({ state: 'visible', timeout: 60000 });
    await expect(arrivedButton).toBeEnabled({ timeout: 5000 });
    await arrivedButton.click();
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
    await this.#page.keyboard.press('Escape');
  }

  /**
   * Set the tracking-board date filter. Accepts MM/DD/YYYY format. The picker defaults
   * to "today in the location's timezone" — call this when the appointment under test
   * is scheduled for a different date (e.g. the first available pre-book slot rolled to
   * tomorrow because the day's schedule is past closing).
   */
  async selectDate(date: string): Promise<void> {
    const dateFromInput = this.#page.getByTestId(dataTestIds.dashboard.dateFromFilter);
    const dateToInput = this.#page.getByTestId(dataTestIds.dashboard.dateToFilter);
    await dateFromInput.click();
    await dateFromInput.fill(date);
    await dateFromInput.blur();
    await dateToInput.click();
    await dateToInput.fill(date);
    await dateToInput.blur();
  }

  async selectGroup(groupName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.groupSelect).click();
    await this.#page.getByText(new RegExp(groupName, 'i')).click();
  }

  async clickAddPatientButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.addPatientButton).click();
  }
}

async function waitForTrackingBoardReady(page: Page): Promise<void> {
  await page.waitForURL(
    (url) =>
      url.pathname === '/visits' &&
      url.searchParams.has('tab') &&
      url.searchParams.has('visitType') &&
      url.searchParams.has('dateFrom') &&
      url.searchParams.has('dateTo'),
    { timeout: 30000 }
  );
}

export async function expectVisitsPage(page: Page): Promise<VisitsPage> {
  await waitForTrackingBoardReady(page);
  return new VisitsPage(page);
}

export async function openVisitsPage(page: Page): Promise<VisitsPage> {
  await page.goto(`/visits`);
  return expectVisitsPage(page);
}
