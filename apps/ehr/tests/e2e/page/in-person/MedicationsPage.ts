import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { Dialog, expectDialog } from '../patient-information/Dialog';
import { SideMenu } from '../SideMenu';
import { EditNoteDialog, expectEditNoteDialog } from './EditNoteDialog';

export class MedicationsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }
  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  async selectMedication(medication: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput)
      .locator('input')
      .fill(medication);
    await this.#page.locator('li').getByText(medication, { exact: false }).click();
  }

  async verifyScheduledMedication(medicationName: string, dose: string): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsScheduledList)
        .filter({ hasText: medicationName + '(' + dose })
    ).toBeVisible();
  }
  async verifyRemovedScheduledMedicationIsNotVisible(medicationName: string, dose: string): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsScheduledList)
        .filter({ hasText: medicationName + '(' + dose })
    ).not.toBeVisible();
  }

  async verifyAsNedeedMedication(medicationName: string, dose: string): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededList)
        .filter({ hasText: medicationName + '(' + dose })
    ).toBeVisible();
  }

  async verifyRemovedAsNeddedMedicationIsNotVisible(medicationName: string, dose: string): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededList)
        .filter({ hasText: medicationName + '(' + dose })
    ).not.toBeVisible();
  }

  async enterDoseUnits(doseUnits: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDoseInput)
      .locator('input')
      .locator('visible=true')
      .fill(doseUnits);
  }

  async enterDateInput(dateInput: string): Promise<void> {
    const locator = this.#page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDateTimeInput);
    await locator.click();
    await locator.pressSequentially(dateInput);
  }

  async selectScheduledMedication(scheduledMedication: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsScheduledRadioButton)
      .getByText(scheduledMedication)
      .setChecked(true);
  }

  async selectAsNeededMedication(asNeededMedication: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededRadioButton)
      .getByText(asNeededMedication)
      .setChecked(true);
  }

  async enterMedicationNote(note: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.screeningNoteField)
      .locator('input')
      .locator('visible=true')
      .fill(note);
  }

  async verifyMedicationNote(note: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.screeningPage.screeningNoteItem)).toContainText(note);
  }

  async verifyRemovedMedicationNoteIsNotVisible(note: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.screeningPage.screeningNoteItem).filter({ hasText: note })
    ).toHaveCount(0);
  }

  async clickAddMedicationNoteButton(): Promise<MedicationsPage> {
    await this.#page.getByTestId(dataTestIds.medicationsPage.addNoteButton).click();
    return expectMedicationsPage(this.#page);
  }

  async clickAddButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton).click();
    await expect(
      this.#page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput).locator('input')
    ).toHaveValue('');
  }

  async verifyMedicationInMedicationHistoryTable(input: {
    medication: string;
    doseUnits: string;
    type: string;
    whoAdded: string;
  }): Promise<void> {
    const testIdToTextArray: { testId: string; text: string | undefined }[] = [
      {
        testId: dataTestIds.inHouseMedicationsPage.medicationHistoryTableMedication,
        text: input.medication + ' ' + '(' + input.doseUnits + ')',
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.medicationHistoryTableType,
        text: input.type,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.medicationHistoryTableWhoAdded,
        text: input.whoAdded,
      },
    ];
    let matchedLocator = this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.medicationHistoryTableRow);
    for (const testIdToText of testIdToTextArray) {
      if (testIdToText.text) {
        matchedLocator = matchedLocator.filter({
          has: this.#page.getByTestId(testIdToText.testId).filter({ hasText: testIdToText.text }),
        });
        await expect(matchedLocator.first()).toBeVisible();
      }
    }
  }

  async verifyRemovedMedicationIsNotPresentInMedicationHistoryTable(input: {
    medication: string;
    doseUnits: string;
    type: string;
  }): Promise<void> {
    const testIdToTextArray: { testId: string; text: string | undefined }[] = [
      {
        testId: dataTestIds.inHouseMedicationsPage.medicationHistoryTableMedication,
        text: input.medication + ' ' + '(' + input.doseUnits + ')',
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.medicationHistoryTableType,
        text: input.type,
      },
    ];
    let matchedLocator = this.#page.getByTestId(dataTestIds.inHouseMedicationsPage.medicationHistoryTableRow);
    for (const testIdToText of testIdToTextArray) {
      if (testIdToText.text) {
        matchedLocator = matchedLocator.filter({
          has: this.#page.getByTestId(testIdToText.testId).filter({ hasText: testIdToText.text }),
        });
        await expect(matchedLocator.first()).not.toBeVisible();
      }
    }
  }

  async clickSeeMoreButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.medicationsPage.seeMoreButton).click();
  }

  async clickDeleteButton(medication: { name: string; dose: string; type: 'scheduled' | 'as-needed' }): Promise<void> {
    await this.#page
      .getByTestId(
        dataTestIds.telemedEhrFlow.hpiCurrentMedicationsListItem(
          dataTestIds.telemedEhrFlow.hpiCurrentMedicationsList(medication.type)
        )
      )
      .filter({ hasText: medication.name + '(' + medication.dose })
      .getByTestId(dataTestIds.medicationsPage.deleteIcon)
      .click();
  }

  async clickEditNoteButton(note: string): Promise<EditNoteDialog> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.screeningNoteItem)
      .filter({ hasText: note })
      .getByTestId(dataTestIds.medicationsPage.pencilIconButton)
      .click();
    return expectEditNoteDialog(this.#page);
  }

  async clickDeleteNoteButton(note: string): Promise<Dialog> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.screeningNoteItem)
      .filter({ hasText: note })
      .getByTestId(dataTestIds.medicationsPage.deleteIcon)
      .click();
    return expectDialog(this.#page);
  }
}

export async function expectMedicationsPage(page: Page): Promise<MedicationsPage> {
  await page.waitForURL(new RegExp('/in-person/.*/medications'));
  await expect(page.getByTestId(dataTestIds.medicationsPage.title)).toBeVisible();
  return new MedicationsPage(page);
}
