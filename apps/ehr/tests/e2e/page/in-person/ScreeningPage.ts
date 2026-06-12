import { expect, Locator, Page } from '@playwright/test';
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
    // Wait for a save-chart-data 200 response. Note: the ASQ observation save fires
    // just before this and may be in-flight — its response could satisfy waitForResponse
    // instead of the actual note save. The toHaveValue('') check below closes that race:
    // the note input is only cleared after useSaveNote.handleSave resolves (the actual
    // note save), so waiting for it to be empty guarantees the note is persisted before we navigate.
    const savePromise = this.#page.waitForResponse(
      (response) => response.url().includes('/save-chart-data') && response.status() === 200,
      { timeout: 30_000 }
    );
    await this.#page.getByTestId(dataTestIds.screeningPage.addNoteButton).click();
    await savePromise;
    await expect(
      this.#page.getByTestId(dataTestIds.screeningPage.screeningNoteField).locator('input').locator('visible=true')
    ).toHaveValue('', { timeout: 15_000 });
    return expectScreeningPage(this.#page);
  }

  askPatientQuestionLocator(fieldId: string): Locator {
    return this.#page.getByTestId(dataTestIds.screeningPage.askPatientQuestion(fieldId));
  }

  async selectRadioAnswer(fieldId: string, answer: string): Promise<void> {
    // Wait for the save API call triggered by debounced onChange (1000ms delay)
    const savePromise = this.#page.waitForResponse(
      (response) => response.url().includes('/save-chart-data') && response.status() === 200,
      { timeout: 30_000 }
    );

    await this.askPatientQuestionLocator(fieldId).locator('label').getByText(answer, { exact: true }).click();

    await savePromise;
  }

  async selectDropdownAnswer(fieldId: string, answer: string): Promise<void> {
    await this.askPatientQuestionLocator(fieldId).getByTestId(dataTestIds.screeningPage.answerDropdown).click();
    await this.#page.getByText(answer, { exact: true }).click();
  }

  async selectDateRange(fieldId: string, startDate: DateTime, endDate: DateTime): Promise<void> {
    // Find the question container and click on the date input to open the picker
    await this.askPatientQuestionLocator(fieldId).locator('input').first().click();

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

  async enterTextAnswer(fieldId: string, text: string): Promise<void> {
    await this.askPatientQuestionLocator(fieldId).locator('input').fill(text);
  }

  async enterTextareaAnswer(fieldId: string, text: string): Promise<void> {
    await this.askPatientQuestionLocator(fieldId).locator('textarea, input').fill(text);
  }
}
export async function expectScreeningPage(page: Page): Promise<ScreeningPage> {
  await page.waitForURL(new RegExp('/in-person/.*/screening-questions'));
  await expect(page.getByTestId(dataTestIds.screeningPage.title)).toBeVisible({ timeout: 30_000 });
  return new ScreeningPage(page);
}
