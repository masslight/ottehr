import { expect, Page } from '@playwright/test';
import { ADDITIONAL_QUESTIONS } from 'src/constants';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { SideMenu } from '../SideMenu';

export class ScreeningPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
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
    await this.#page.getByTestId(dataTestIds.screeningPage.addNoteButton).click();
    return expectScreeningPage(this.#page);
  }

  async selectRadioAnswer(question: string, answer: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.askPatientQuestion)
      .filter({ hasText: question })
      .locator('label')
      .getByText(answer, { exact: true })
      .click();
  }

  async answerAllAdditionalQuestions(answer: string): Promise<void> {
    for (const question of ADDITIONAL_QUESTIONS) {
      const questionRadioLocator = this.#page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))
        .locator('label')
        .filter({ hasText: answer });
      await questionRadioLocator.click();
      await expect(questionRadioLocator).toBeEnabled();
    }
  }

  async enterVaccinationNote(note: string): Promise<void> {
    await this.#page.waitForTimeout(3000);
    await this.#page
      .getByTestId(dataTestIds.screeningPage.vaccinationNoteField)
      .locator('input')
      .locator('visible=true')
      .fill(note);
  }

  async selectDropdownAnswer(question: string, answer: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.askPatientQuestion)
      .filter({ hasText: question })
      .getByTestId(dataTestIds.screeningPage.answerDropdown)
      .click();
    await this.#page.getByText(answer, { exact: true }).click();
  }
}
export async function expectScreeningPage(page: Page): Promise<ScreeningPage> {
  await page.waitForURL(new RegExp('/in-person/.*/screening-questions'));
  await expect(page.getByTestId(dataTestIds.screeningPage.title)).toBeVisible();
  return new ScreeningPage(page);
}
