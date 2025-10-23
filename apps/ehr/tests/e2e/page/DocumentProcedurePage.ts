import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { expectProceduresPage, ProceduresPage } from './ProceduresPage';

export class DocumentProcedurePage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async setConsentForProcedureChecked(checked: boolean): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.documentProcedurePage.consentForProcedure)
      .locator('input')
      .setChecked(checked);
  }

  async verifyConsentForProcedureChecked(checked: boolean): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.documentProcedurePage.consentForProcedure).locator('input')
    ).toBeChecked({ checked });
  }

  async selectProcedureType(type: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.procedureType).click();
    await this.#page.getByText(type, { exact: true }).click();
  }

  async verifyProcedureType(type: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.documentProcedurePage.procedureType).locator('input')).toHaveValue(
      type
    );
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
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.performedBy).getByText(performedBy).setChecked(true);
  }

  async verifyPerformedBy(performedBy: string): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.documentProcedurePage.performedBy)
        .filter({ hasText: performedBy })
        .getByTestId(dataTestIds.radioButton.checkedIcon)
    ).toBeVisible();
  }

  async selectAnaesthesia(anaesthesia: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.anaesthesia).click();
    await this.#page.getByText(anaesthesia, { exact: true }).click();
  }

  async verifyAnaesthesia(anaesthesia: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.documentProcedurePage.anaesthesia).locator('input')).toHaveValue(
      anaesthesia
    );
  }

  async selectSite(site: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.site).click();
    await this.#page.getByText(site, { exact: true }).click();
  }

  async verifySite(site: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.documentProcedurePage.site).locator('input')).toHaveValue(site);
  }

  async selectSideOfBody(sidOfBody: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.sideOfBody).click();
    await this.#page.getByText(sidOfBody, { exact: true }).click();
  }

  async verifySideOfBody(sidOfBody: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.documentProcedurePage.sideOfBody).locator('input')).toHaveValue(
      sidOfBody
    );
  }

  async selectTechnique(technique: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.technique).click();
    await this.#page.getByText(technique, { exact: true }).click();
  }

  async verifyTechnique(technique: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.documentProcedurePage.technique).locator('input')).toHaveValue(
      technique
    );
  }

  async selectInstruments(instruments: string[]): Promise<void> {
    const field = this.#page.getByTestId(dataTestIds.documentProcedurePage.instruments);
    await field.click();

    for (const instrument of instruments) {
      await this.#page.getByText(instrument, { exact: true }).click();
    }

    await this.#page.keyboard.press('Escape');
  }

  async verifyInstruments(expected: string[]): Promise<void> {
    const instrumentsField = this.#page.getByTestId(dataTestIds.documentProcedurePage.instruments);
    const displayedText = await instrumentsField.textContent();

    for (const item of expected) {
      expect(displayedText).toContain(item);
    }
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

  async selectSpecimenSent(specimenSent: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.documentProcedurePage.specimenSent)
      .getByText(specimenSent)
      .setChecked(true);
  }

  async verifySpecimenSent(specimenSent: string): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.documentProcedurePage.specimenSent)
        .filter({ hasText: specimenSent })
        .getByTestId(dataTestIds.radioButton.checkedIcon)
    ).toBeVisible();
  }

  async selectComplications(complications: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.complications).click();
    await this.#page.getByText(complications, { exact: true }).click();
  }

  async verifyComplications(complications: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.documentProcedurePage.complications).locator('input')).toHaveValue(
      complications
    );
  }

  async selectPatientResponse(patientResponse: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.patientResponse).click();
    await this.#page.getByText(patientResponse, { exact: true }).click();
  }

  async verifyPatientResponse(patientResponse: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.documentProcedurePage.patientResponse).locator('input')
    ).toHaveValue(patientResponse);
  }

  async selectPostProcedureInstructions(postProcedureInstructions: string[]): Promise<void> {
    const field = this.#page.getByTestId(dataTestIds.documentProcedurePage.postProcedureInstructions);
    await field.click();

    for (const instruction of postProcedureInstructions) {
      await this.#page.getByText(instruction, { exact: true }).click();
    }

    await this.#page.keyboard.press('Escape');
  }

  async verifyPostProcedureInstructions(expected: string[]): Promise<void> {
    const instructionsField = this.#page.getByTestId(dataTestIds.documentProcedurePage.postProcedureInstructions);
    const displayedText = await instructionsField.textContent();

    for (const item of expected) {
      expect(displayedText).toContain(item);
    }
  }

  async selectTimeSpent(timeSpent: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.timeSpent).click();
    await this.#page.getByText(timeSpent, { exact: true }).click();
  }

  async verifyTimeSpent(timeSpent: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.documentProcedurePage.timeSpent).locator('input')).toHaveValue(
      timeSpent
    );
  }

  async selectDocumentedBy(documentedBy: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.documentProcedurePage.documentedBy)
      .getByText(documentedBy)
      .setChecked(true);
  }

  async verifyDocumentedBy(documentedBy: string): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.documentProcedurePage.documentedBy)
        .filter({ hasText: documentedBy })
        .getByTestId(dataTestIds.radioButton.checkedIcon)
    ).toBeVisible();
  }

  async clickSaveButton(): Promise<ProceduresPage> {
    await this.#page.getByTestId(dataTestIds.documentProcedurePage.saveButton).click();
    return await expectProceduresPage(this.#page);
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
