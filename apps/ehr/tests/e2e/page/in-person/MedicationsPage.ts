import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { Dialog, expectDialog } from '../patient-information/Dialog';
import { SideMenu } from '../SideMenu';
import { EditNoteDialog, expectEditNoteDialog } from './EditNoteDialog';

const SCHEDULED_MEDICATION = 'Scheduled medication';
const AS_NEEDED_MEDICATION = 'As needed medication';
const AS_NEEDED_MEDICATION_DASH = 'As-needed medication';

export interface MedicationInfo {
  name: string;
  dose: string;
  date: string;
}

export class MedicationsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }
  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  async addMedication(
    medicationInfo: MedicationInfo,
    whoAdded: string,
    type: 'scheduled' | 'as-needed'
  ): Promise<void> {
    if (type === 'scheduled') {
      await this.#checkScheduledMedicationRadio();
    } else {
      await this.#checkAsNeededMedicationRadio();
    }

    await this.#selectMedication(medicationInfo.name);
    await this.#enterDoseUnits(medicationInfo.dose);
    await this.#enterDateInput(medicationInfo.date);
    await this.#clickAddButton();

    if (type === 'scheduled') {
      await this.#verifyScheduledMedication(medicationInfo.name, medicationInfo.dose);
    } else {
      await this.#verifyAsNeededMedication(medicationInfo.name, medicationInfo.dose);
    }

    await this.#verifyMedicationInMedicationHistoryTable({
      ...medicationInfo,
      whoAdded,
      type: type === 'scheduled' ? SCHEDULED_MEDICATION : AS_NEEDED_MEDICATION_DASH,
    });
  }

  async removeMedication(medicationInfo: MedicationInfo, type: 'scheduled' | 'as-needed'): Promise<void> {
    await this.#clickDeleteButton({ ...medicationInfo, type });
    if (type === 'scheduled') {
      await this.#verifyScheduledMedicationIsNotVisible(medicationInfo.name, medicationInfo.dose);
    } else {
      await this.#verifyAsNeededMedicationIsNotVisible(medicationInfo.name, medicationInfo.dose);
    }
    await this.#verifyMedicationIsNotPresentInMedicationHistoryTable({ ...medicationInfo, type });
  }

  async addMedicationNote(note: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.screeningNoteField)
      .locator('input')
      .locator('visible=true')
      .fill(note);
    await this.#page.getByTestId(dataTestIds.medicationsPage.addNoteButton).click();
    await this.#verifyMedicationNote(note);
  }

  async editMedicationNote(originalNote: string, editedNote: string): Promise<void> {
    const editDialog = await this.#clickEditNoteButton(originalNote);
    await editDialog.verifyTitle('Edit Medication Note');
    await editDialog.clearNote();
    await editDialog.enterNote(editedNote);
    await editDialog.clickProceedButton();
    await this.#verifyMedicationNote(editedNote);
  }

  async deleteMedicationNote(originalNote: string): Promise<void> {
    const deleteDialog = await this.#clickDeleteNoteButton(originalNote);
    await deleteDialog.verifyTitle('Delete medication note');
    await deleteDialog.verifyModalContent('Are you sure you want to permanently delete this medication note?');
    await deleteDialog.verifyModalContent(originalNote);
    await deleteDialog.clickProceedButton();
    await expect(
      this.#page.getByTestId(dataTestIds.screeningPage.screeningNoteItem).filter({ hasText: originalNote })
    ).not.toBeVisible();
  }

  async #clickEditNoteButton(note: string): Promise<EditNoteDialog> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.screeningNoteItem)
      .filter({ hasText: note })
      .getByTestId(dataTestIds.medicationsPage.pencilIconButton)
      .click();
    return expectEditNoteDialog(this.#page);
  }

  async #clickDeleteNoteButton(note: string): Promise<Dialog> {
    await this.#page
      .getByTestId(dataTestIds.screeningPage.screeningNoteItem)
      .filter({ hasText: note })
      .getByTestId(dataTestIds.medicationsPage.deleteIcon)
      .click();
    return expectDialog(this.#page);
  }

  async verifyRemovedMedicationNoteIsNotVisible(note: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.screeningPage.screeningNoteItem).filter({ hasText: note })
    ).toHaveCount(0);
  }

  async #selectMedication(medication: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput)
      .locator('input')
      .fill(medication);
    await this.#page.locator('li').getByText(medication, { exact: false }).click();
  }

  async #verifyScheduledMedication(medicationName: string, dose: string): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsScheduledList)
        .filter({ hasText: medicationName + '(' + dose })
    ).toBeVisible();
  }

  async #verifyScheduledMedicationIsNotVisible(medicationName: string, dose: string): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsScheduledList)
        .filter({ hasText: medicationName + '(' + dose })
    ).not.toBeVisible();
  }

  async #verifyAsNeededMedication(medicationName: string, dose: string): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededList)
        .filter({ hasText: medicationName + '(' + dose })
    ).toBeVisible();
  }

  async #verifyAsNeededMedicationIsNotVisible(medicationName: string, dose: string): Promise<void> {
    await expect(
      this.#page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededList)
        .filter({ hasText: medicationName + '(' + dose })
    ).not.toBeVisible();
  }

  async #enterDoseUnits(doseUnits: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDoseInput)
      .locator('input')
      .locator('visible=true')
      .fill(doseUnits);
  }

  async #enterDateInput(dateInput: string): Promise<void> {
    const locator = this.#page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDateTimeInput);
    await locator.click();
    await locator.pressSequentially(dateInput);
  }

  async #checkScheduledMedicationRadio(): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsScheduledRadioButton)
      .getByText(SCHEDULED_MEDICATION)
      .setChecked(true);
  }

  async #checkAsNeededMedicationRadio(): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededRadioButton)
      .getByText(AS_NEEDED_MEDICATION)
      .setChecked(true);
  }

  async #verifyMedicationNote(note: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.screeningPage.screeningNoteItem).filter({ hasText: note })
    ).toBeVisible();
  }

  async #clickAddButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton).click();
    await expect(
      this.#page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput).locator('input')
    ).toHaveValue('');
  }

  async #verifyMedicationInMedicationHistoryTable(medication: {
    name: string;
    dose: string;
    type: string;
    whoAdded: string;
  }): Promise<void> {
    await this.#clickSeeMoreButton();
    const testIdToTextArray: { testId: string; text: string | undefined }[] = [
      {
        testId: dataTestIds.inHouseMedicationsPage.medicationHistoryTableMedication,
        text: medication.name + ' ' + '(' + medication.dose + ')',
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.medicationHistoryTableType,
        text: medication.type,
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.medicationHistoryTableWhoAdded,
        text: medication.whoAdded,
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

  async #verifyMedicationIsNotPresentInMedicationHistoryTable(medication: {
    name: string;
    dose: string;
    type: string;
  }): Promise<void> {
    const testIdToTextArray: { testId: string; text: string | undefined }[] = [
      {
        testId: dataTestIds.inHouseMedicationsPage.medicationHistoryTableMedication,
        text: medication.name + ' ' + '(' + medication.dose + ')',
      },
      {
        testId: dataTestIds.inHouseMedicationsPage.medicationHistoryTableType,
        text: medication.type,
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

  async #clickDeleteButton(medication: { name: string; dose: string; type: 'scheduled' | 'as-needed' }): Promise<void> {
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

  async #clickSeeMoreButton(): Promise<void> {
    const locator = this.#page.getByTestId(dataTestIds.medicationsPage.seeMoreButton);
    if (await locator.isVisible()) {
      await locator.click();
    }
  }
}

export async function expectMedicationsPage(page: Page): Promise<MedicationsPage> {
  await page.waitForURL(new RegExp('/in-person/.*/medications'));
  await expect(page.getByTestId(dataTestIds.medicationsPage.title)).toBeVisible();
  return new MedicationsPage(page);
}
