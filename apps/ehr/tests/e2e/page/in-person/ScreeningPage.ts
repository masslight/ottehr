import { expect, Page } from '@playwright/test';
import { DateTime } from 'luxon';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { SideMenu } from '../SideMenu';

export class ScreeningPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  page(): Page {
    return this.#page;
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  async selectAsqAnswer(answer: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.screeningPage.asqQuestion).click();
    await this.#page.getByText(answer, { exact: true }).click();
  }

  async enterScreeningNote(note: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.screeningNoteField)
      .locator('input')
      .locator('visible=true')
      .fill(note);
  }

  async clickAddScreeningNoteButton(): Promise<ScreeningPage> {
    // Wait for the save API call to complete before returning
    const savePromise = this.#page.waitForResponse(
      (response) => response.url().includes('/save-chart-data') && response.status() === 200,
      { timeout: 30_000 }
    );
    await this.#page.getByTestId(dataTestIds.screeningPage.addNoteButton).click();
    await savePromise;
    return expectScreeningPage(this.#page);
  }

  async selectRadioAnswer(question: string, answer: string): Promise<void> {
    // Wait for the save API call triggered by debounced onChange (1000ms delay)
    const savePromise = this.#page.waitForResponse(
      (response) => response.url().includes('/save-chart-data') && response.status() === 200,
      { timeout: 30_000 }
    );

    await this.#page
      .getByTestId(dataTestIds.screeningPage.askPatientQuestion)
      .or(this.#page.locator(`[data-testid^="${dataTestIds.telemedEhrFlow.hpiAdditionalQuestions('')}"]`))
      .filter({ hasText: question })
      .locator('label')
      .getByText(answer, { exact: true })
      .click();

    await savePromise;
  }

  async selectDropdownAnswer(question: string, answer: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.askPatientQuestion)
      .filter({ hasText: question })
      .getByTestId(dataTestIds.screeningPage.answerDropdown)
      .click();
    await this.#page.getByText(answer, { exact: true }).click();
  }

  async selectDateRange(question: string, startDate: DateTime, endDate: DateTime): Promise<void> {
    // Find the question container and click on the date input to open the picker
    const questionContainer = this.#page
      .getByTestId(dataTestIds.screeningPage.askPatientQuestion)
      .filter({ hasText: question });

    await questionContainer.locator('input').first().click();

    // Wait for the calendar picker to be visible
    const calendar = this.#page.locator('.MuiDateRangeCalendar-root');
    await calendar.waitFor({ state: 'visible' });

    // Test dates are always in current month (days 20-30)
    // MUI shows two months side by side, so dates might appear in both calendars
    // Use .first() to select from the left (current month) calendar
    await calendar.getByRole('gridcell', { name: startDate.day.toString(), exact: true }).first().click();

    await calendar.getByRole('gridcell', { name: endDate.day.toString(), exact: true }).first().click();

    // Click the Apply button to confirm selection
    await this.#page.getByRole('button', { name: 'Apply' }).click();

    // Wait for the calendar picker to close (UI confirmation)
    await calendar.waitFor({ state: 'hidden' });
  }

  async enterTextAnswer(question: string, text: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.askPatientQuestion)
      .filter({ hasText: question })
      .locator('input')
      .fill(text);
  }

  async enterTextareaAnswer(question: string, text: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.askPatientQuestion)
      .filter({ hasText: question })
      .locator('textarea, input')
      .fill(text);
  }
}
export async function expectScreeningPage(page: Page): Promise<ScreeningPage> {
  await page.waitForURL(new RegExp('/in-person/.*/screening-questions'));
  await expect(page.getByTestId(dataTestIds.screeningPage.title)).toBeVisible({ timeout: 30_000 });
  return new ScreeningPage(page);
}
