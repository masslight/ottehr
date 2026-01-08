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

  async selectHospitalization(hospitalization: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.hospitalizationPage.hospitalizationDropdown).click();
    await this.#page.getByText(hospitalization, { exact: true }).click();
  }

  async verifyHospitalization(hospitalization: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.hospitalizationPage.hospitalizationList).filter({ hasText: hospitalization })
    ).toBeVisible();
  }

  async verifyRemovedHospitalizationIsNotVisible(hospitalization: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.hospitalizationPage.hospitalizationList).filter({ hasText: hospitalization })
    ).not.toBeVisible();
  }

  async clickDeleteButton(hospitalizationName: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.hospitalizationPage.hospitalizationList)
      .filter({ hasText: hospitalizationName })
      .getByTestId(dataTestIds.hospitalizationPage.deleteIcon)
      .click();
  }

  async enterHospitalizationNote(note: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.screeningNoteField)
      .locator('input')
      .locator('visible=true')
      .fill(note);
  }

  async verifyHospitalizationNote(note: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.screeningPage.screeningNoteItem)).toContainText(note);
  }

  async verifyRemovedHospitalizationNoteIsNotVisible(note: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.screeningPage.screeningNoteItem).filter({ hasText: note })
    ).toHaveCount(0);
  }

  async clickAddHospitalizationNoteButton(): Promise<HospitalizationPage> {
    await this.#page.getByTestId(dataTestIds.hospitalizationPage.addNoteButton).click();
    return expectHospitalizationPage(this.#page);
  }

  async clickEditNoteButton(note: string): Promise<EditNoteDialog> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.screeningNoteItem)
      .filter({ hasText: note })
      .getByTestId(dataTestIds.hospitalizationPage.pencilIconButton)
      .click();
    return expectEditNoteDialog(this.#page);
  }

  async clickDeleteNoteButton(note: string): Promise<Dialog> {
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
