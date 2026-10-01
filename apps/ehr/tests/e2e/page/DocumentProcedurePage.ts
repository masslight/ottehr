import { expect, Locator, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { BLANK_POPOVER_TEST_ID } from 'src/features/visits/in-person/components/procedures/narrative/InlineBlanks';
import { sentenceValue } from 'src/features/visits/in-person/components/procedures/narrative/sentenceValue';
import { performerDisplay } from 'src/features/visits/in-person/pages/procedurePerformerOptions';
import { expectProceduresPage, ProceduresPage } from './ProceduresPage';

export class DocumentProcedurePage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async setConsentForProcedureChecked(checked: boolean): Promise<void> {
    // Consent blank is optional - exists in some repos but not in others
    const count = await this.#page.getByTestId(dataTestIds.documentProcedurePage.consentForProcedure).count();
    if (count > 0) {
      await this.#pick(dataTestIds.documentProcedurePage.consentForProcedure, checked ? 'obtained' : 'not obtained');
    }
  }

  async verifyConsentForProcedureChecked(checked: boolean): Promise<void> {
    const consentBlank = this.#page.getByTestId(dataTestIds.documentProcedurePage.consentForProcedure);

    // Consent blank is optional - exists in some repos but not in others
    const count = await consentBlank.count();
    if (count > 0) {
      await expect(consentBlank).toHaveText(checked ? 'obtained' : 'not obtained');
    }
  }

  async selectProcedureType(type: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.procedureType).click();
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.procedureTypeInput).locator('input').fill(type);
    await this.#page.getByRole('option', { name: type, exact: true }).click();
    await this.#page.keyboard.press('Escape');
  }

  async verifyProcedureType(type: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.documentProcedurePage.procedureType)).toHaveText(type);
  }

  async selectCptCode(cptCode: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.cptCodeInput).locator('input').fill(cptCode);
    await this.#page.locator('li').getByText(cptCode, { exact: false }).click();
  }

  async verifyCptCode(cptCode: string): Promise<void> {
    const code = (await this.#page.getByTestId(dataTestIds.documentProcedurePage.cptCode).allInnerTexts()).find(
      (text) => text.includes(cptCode)
    );
    expect(code).toBe(cptCode);
  }

  async selectDiagnosis(diagnosis: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.addDiagnosis).click();
    await this.#page.getByTestId(dataTestIds.diagnosisContainer.diagnosisDropdown).locator('input').fill(diagnosis);
    await this.#page.locator('li').getByText(diagnosis, { exact: false }).click();
  }

  async deleteDiagnosis(diagnosis: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.documentProcedurePage.diagnosisItem)
      .filter({ hasText: diagnosis })
      .getByTestId(dataTestIds.documentProcedurePage.diagnosisDeleteButton)
      .click();
  }

  async verifyDiagnosis(diagnosis: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.documentProcedurePage.diagnosis).filter({ hasText: diagnosis })
    ).toBeVisible();
  }

  async selectPerformedBy(performedBy: string): Promise<void> {
    // Arguments are the stored values ("Provider", "Both"); the sentence shows their display wording.
    await this.#pick(dataTestIds.documentProcedurePage.performedBy, performerDisplay(performedBy) ?? performedBy);
  }

  async verifyPerformedBy(performedBy: string): Promise<void> {
    await this.#verifyBlank(
      dataTestIds.documentProcedurePage.performedBy,
      performerDisplay(performedBy) ?? performedBy
    );
  }

  async selectAnaesthesia(anaesthesia: string): Promise<void> {
    await this.#pick(dataTestIds.documentProcedurePage.anaesthesia, anaesthesia);
  }

  async verifyAnaesthesia(anaesthesia: string): Promise<void> {
    await this.#verifyBlank(dataTestIds.documentProcedurePage.anaesthesia, anaesthesia);
  }

  async selectSite(site: string): Promise<void> {
    await this.#pick(dataTestIds.documentProcedurePage.site, site);
  }

  async verifySite(site: string): Promise<void> {
    await this.#verifyBlank(dataTestIds.documentProcedurePage.site, site);
  }

  async selectSideOfBody(sidOfBody: string): Promise<void> {
    await this.#pick(dataTestIds.documentProcedurePage.sideOfBody, sidOfBody);
  }

  async verifySideOfBody(sidOfBody: string): Promise<void> {
    await this.#verifyBlank(dataTestIds.documentProcedurePage.sideOfBody, sidOfBody);
  }

  async selectTechnique(technique: string[]): Promise<void> {
    await this.#selectFromMultiselect(dataTestIds.documentProcedurePage.technique, technique);
  }

  async verifyTechnique(technique: string[]): Promise<void> {
    await this.#verifyMultiselect(dataTestIds.documentProcedurePage.technique, technique);
  }

  async selectInstruments(instruments: string[]): Promise<void> {
    await this.#selectFromMultiselect(dataTestIds.documentProcedurePage.instruments, instruments);
  }

  async verifyInstruments(expected: string[]): Promise<void> {
    await this.#verifyMultiselect(dataTestIds.documentProcedurePage.instruments, expected);
  }

  async enterProcedureDetails(procedureDetails: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.documentProcedurePage.procedureDetails)
      .locator('textarea')
      .locator('visible=true')
      .fill(procedureDetails);
  }

  async verifyProcedureDetails(procedureDetails: string): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.documentProcedurePage.procedureDetails)
        .locator('textarea')
        .locator('visible=true')
    ).toHaveValue(procedureDetails);
  }

  /** Accepts the historical "Yes" / "No" answers; the sentence reads "Specimen sent" / "Specimen not sent". */
  async selectSpecimenSent(specimenSent: string): Promise<void> {
    await this.#pick(dataTestIds.documentProcedurePage.specimenSent, specimenSent === 'Yes' ? 'sent' : 'not sent');
  }

  async verifySpecimenSent(specimenSent: string): Promise<void> {
    await this.#verifyBlank(
      dataTestIds.documentProcedurePage.specimenSent,
      specimenSent === 'Yes' ? 'sent' : 'not sent'
    );
  }

  async selectComplications(complications: string): Promise<void> {
    await this.#pick(dataTestIds.documentProcedurePage.complications, complications);
  }

  async verifyComplications(complications: string): Promise<void> {
    await this.#verifyBlank(dataTestIds.documentProcedurePage.complications, complications);
  }

  async selectPatientResponse(patientResponse: string): Promise<void> {
    await this.#pick(dataTestIds.documentProcedurePage.patientResponse, patientResponse);
  }

  async verifyPatientResponse(patientResponse: string): Promise<void> {
    await this.#verifyBlank(dataTestIds.documentProcedurePage.patientResponse, patientResponse);
  }

  async selectPostProcedureInstructions(postProcedureInstructions: string[]): Promise<void> {
    await this.#selectFromMultiselect(
      dataTestIds.documentProcedurePage.postProcedureInstructions,
      postProcedureInstructions
    );
  }

  async verifyPostProcedureInstructions(expected: string[]): Promise<void> {
    await this.#verifyMultiselect(dataTestIds.documentProcedurePage.postProcedureInstructions, expected);
  }

  async selectTimeSpent(timeSpent: string): Promise<void> {
    await this.#pick(dataTestIds.documentProcedurePage.timeSpent, timeSpent);
  }

  async verifyTimeSpent(timeSpent: string): Promise<void> {
    await this.#verifyBlank(dataTestIds.documentProcedurePage.timeSpent, timeSpent);
  }

  async selectDocumentedBy(documentedBy: string): Promise<void> {
    // Arguments are the stored values ("Provider", "Both"); the sentence shows their display wording.
    await this.#pick(dataTestIds.documentProcedurePage.documentedBy, performerDisplay(documentedBy) ?? documentedBy);
  }

  async verifyDocumentedBy(documentedBy: string): Promise<void> {
    await this.#verifyBlank(
      dataTestIds.documentProcedurePage.documentedBy,
      performerDisplay(documentedBy) ?? documentedBy
    );
  }

  async clickSaveButton(): Promise<ProceduresPage> {
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.saveButton).click();
    return await expectProceduresPage(this.#page);
  }

  /** Every single-value field is a blank in a sentence: click it, then pick from the popover list. */
  async #pick(testId: string, value: string): Promise<void> {
    await this.#page.getByTestId(testId).click();
    await this.#popover().getByRole('option', { name: value, exact: true }).click();
  }

  /** Arguments are stored values; the sentence shows them in prose case ("Local" reads "local"). */
  async #verifyBlank(testId: string, value: string): Promise<void> {
    await expect(this.#page.getByTestId(testId)).toHaveText(sentenceValue(value));
  }

  #popover(): Locator {
    return this.#page.getByTestId(BLANK_POPOVER_TEST_ID);
  }

  async #selectFromMultiselect(testId: string, values: string[]): Promise<void> {
    await this.#page.getByTestId(testId).click();
    const popover = this.#popover();

    const checked = popover.getByRole('checkbox', { checked: true });
    for (let i = (await checked.count()) - 1; i >= 0; i--) {
      await checked.nth(i).uncheck();
    }

    for (const value of values) {
      await popover.getByRole('checkbox', { name: value, exact: true }).check();
    }

    await popover.getByRole('button', { name: 'Done' }).click();
  }

  async #verifyMultiselect(testId: string, expectedValues: string[]): Promise<void> {
    const blank = this.#page.getByTestId(testId);
    if (expectedValues.length === 0) {
      await expect(blank).toHaveText(/^\+ /);
      return;
    }
    for (const expectedValue of expectedValues) {
      await expect(blank).toContainText(sentenceValue(expectedValue));
    }
  }
}

export async function expectDocumentProcedurePage(page: Page): Promise<DocumentProcedurePage> {
  await page.waitForURL(new RegExp('/in-person/.*/procedures/*'));
  await expect(page.getByTestId(dataTestIds.documentProcedurePage.title)).toBeVisible();
  return new DocumentProcedurePage(page);
}

export async function openDocumentProcedurePage(appointmentId: string, page: Page): Promise<DocumentProcedurePage> {
  await page.goto(`/in-person/${appointmentId}/procedures/new`);
  return expectDocumentProcedurePage(page);
}
