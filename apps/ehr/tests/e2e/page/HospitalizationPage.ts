import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { EditNoteDialog, expectEditNoteDialog } from './in-person/EditNoteDialog';
import { InPersonHeader } from './InPersonHeader';
import { Dialog, expectDialog } from './patient-information/Dialog';
import { SideMenu } from './SideMenu';

export class HospitalizationPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  inPersonHeader(): InPersonHeader {
    return new InPersonHeader(this.#page);
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  async clickCompleteIntakeButton(): Promise<void> {
    await this.#page.locator('button:text("Confirmed No Hospitalization AND Complete Intake")').click();
    await this.sideMenu().clickCompleteIntakeButton();
  }

  async addHospitalization(hospitalization: string): Promise<void> {
    // Wait for chart data to finish loading (skeleton indicates loading state)
    await expect(
      this.#page.getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton).first()
    ).not.toBeVisible();

    const dropdown = this.#page.getByTestId(dataTestIds.hospitalizationPage.hospitalizationDropdown);
    const input = dropdown.locator('input');

    // Ensure the input is enabled before clicking
    await expect(input).toBeEnabled();
    await input.click();

    const option = this.#page.getByRole('option', { name: hospitalization });
    await expect(option).toBeVisible();
    await option.click();

    await expect(
      this.#page.getByTestId(dataTestIds.hospitalizationPage.hospitalizationList).filter({ hasText: hospitalization })
    ).toBeVisible();
  }

  async removeHospitalization(hospitalization: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.hospitalizationPage.hospitalizationList)
      .filter({ hasText: hospitalization })
      .getByTestId(dataTestIds.hospitalizationPage.deleteIcon)
      .click();
    await expect(
      this.#page.getByTestId(dataTestIds.hospitalizationPage.hospitalizationList).filter({ hasText: hospitalization })
    ).not.toBeVisible();
  }

  async addHospitalizationNote(note: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.screeningNoteField)
      .locator('input')
      .locator('visible=true')
      .fill(note);
    await this.#page.getByTestId(dataTestIds.hospitalizationPage.addNoteButton).click();
    await this.#verifyHospitalizationNote(note);
  }

  async editHospitalizationNote(originalNote: string, editedNote: string): Promise<void> {
    const editDialog = await this.#clickEditNoteButton(originalNote);
    await editDialog.verifyTitle('Edit Hospitalization Note');
    await editDialog.clearNote();
    await editDialog.enterNote(editedNote);
    await editDialog.clickProceedButton();
    await this.#verifyHospitalizationNote(editedNote);
  }

  async deleteHospitalizationNote(originalNote: string): Promise<void> {
    const deleteDialog = await this.#clickDeleteNoteButton(originalNote);
    await deleteDialog.verifyTitle('Delete hospitalization note');
    await deleteDialog.verifyModalContent('Are you sure you want to permanently delete this hospitalization note?');
    await deleteDialog.verifyModalContent(originalNote);
    await deleteDialog.clickProceedButton();
    await expect(
      this.#page.getByTestId(dataTestIds.screeningPage.screeningNoteItem).filter({ hasText: originalNote })
    ).toHaveCount(0);
  }

  async #clickEditNoteButton(note: string): Promise<EditNoteDialog> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.screeningNoteItem)
      .filter({ hasText: note })
      .getByTestId(dataTestIds.hospitalizationPage.pencilIconButton)
      .click();
    return expectEditNoteDialog(this.#page);
  }

  async #verifyHospitalizationNote(note: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.screeningPage.screeningNoteItem).filter({ hasText: note })
    ).toBeVisible();
  }

  async #clickDeleteNoteButton(note: string): Promise<Dialog> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.screeningNoteItem)
      .filter({ hasText: note })
      .getByTestId(dataTestIds.hospitalizationPage.deleteIcon)
      .click();
    return expectDialog(this.#page);
  }
}

export async function expectHospitalizationPage(page: Page): Promise<HospitalizationPage> {
  await page.waitForURL(new RegExp('/in-person/.*/hospitalization'));
  await expect(page.getByTestId(dataTestIds.hospitalizationPage.hospitalizationTitle)).toBeVisible();
  return new HospitalizationPage(page);
}
