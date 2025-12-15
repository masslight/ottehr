import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import {
  expectInPersonProgressNotePage,
  InPersonProgressNotePage,
} from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { expectMedicationsPage, MedicationsPage } from 'tests/e2e/page/in-person/MedicationsPage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';
import { getFirstName, getLastName } from 'utils';

const resourceHandler = new ResourceHandler(`screening-mutating-${DateTime.now().toMillis()}`);

interface MedicationsInfo {
  name: string;
  dose: string;
  date: string;
}

const MEDICATION_A: MedicationsInfo = {
  name: 'Warfarin Sodium  Powder',
  dose: '1 mg',
  date: '11/28/2025 01:00 PM',
};

const MEDICATION_B: MedicationsInfo = {
  name: 'Albuterol Sulfate  Powder',
  dose: '10 g',
  date: '01/01/2025 03:00 PM',
};

const MEDICATION_C: MedicationsInfo = {
  name: 'Water Oral Oral Liquid',
  dose: '2 mg',
  date: '02/02/2025 02:00 PM',
};

const MEDICATION_D: MedicationsInfo = {
  name: 'Banana Cream Flavor  Liquid',
  dose: '5 mg',
  date: '03/03/2025 05:00 PM',
};

const SCHEDULED_MEDICATION = 'Scheduled medication';
const AS_NEEDED_MEDICATION = 'As needed medication';
const AS_NEEDED_MEDICATION_DASH = 'As-needed medication';
const MEDICATION_NOTE = 'Test medication note';
const MEDICATION_NOTE_EDITED = 'Test medication note edited';

test.describe('Medications Page mutating tests', () => {
  test.beforeEach(async ({ page }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
    await setupPractitioners(page);
  });

  test.afterEach(async () => {
    await resourceHandler.cleanupResources();
  });

  test('MED-1 Medications happy path', async ({ page }) => {
    let medicationsPage =
      await test.step('MED-1.1 Add scheduled and as-needed medications, verify medications are present in Medications container', async () => {
        const progressNotePage = await expectInPersonProgressNotePage(page);
        const medicationsPage = await progressNotePage.sideMenu().clickMedications();
        await medicationsPage.selectScheduledMedication(SCHEDULED_MEDICATION);
        await enterMedicationsInfo(MEDICATION_A, medicationsPage);
        await medicationsPage.verifyScheduledMedication(MEDICATION_A.name, MEDICATION_A.dose);
        await enterMedicationsInfo(MEDICATION_B, medicationsPage);
        await medicationsPage.verifyScheduledMedication(MEDICATION_A.name, MEDICATION_A.dose);
        await medicationsPage.verifyScheduledMedication(MEDICATION_B.name, MEDICATION_B.dose);
        await medicationsPage.selectAsNeededMedication(AS_NEEDED_MEDICATION);
        await enterMedicationsInfo(MEDICATION_C, medicationsPage);
        await medicationsPage.verifyScheduledMedication(MEDICATION_A.name, MEDICATION_A.dose);
        await medicationsPage.verifyScheduledMedication(MEDICATION_B.name, MEDICATION_B.dose);
        await medicationsPage.verifyAsNeededMedication(MEDICATION_C.name, MEDICATION_C.dose);
        await medicationsPage.selectAsNeededMedication(AS_NEEDED_MEDICATION);
        await enterMedicationsInfo(MEDICATION_D, medicationsPage);
        await medicationsPage.verifyScheduledMedication(MEDICATION_A.name, MEDICATION_A.dose);
        await medicationsPage.verifyScheduledMedication(MEDICATION_B.name, MEDICATION_B.dose);
        await medicationsPage.verifyAsNeededMedication(MEDICATION_C.name, MEDICATION_C.dose);
        await medicationsPage.verifyAsNeededMedication(MEDICATION_D.name, MEDICATION_D.dose);
        return await expectMedicationsPage(page);
      });

    await test.step('MED-1.2 Verify medications on Medication history table ', async () => {
      await medicationsPage.clickSeeMoreButton();
      await medicationsPage.verifyMedicationInMedicationHistoryTable({
        medication: MEDICATION_A.name,
        doseUnits: MEDICATION_A.dose,
        type: SCHEDULED_MEDICATION,
        whoAdded: await getCurrentPractitionerFirstLastName(),
      });

      await medicationsPage.verifyMedicationInMedicationHistoryTable({
        medication: MEDICATION_B.name,
        doseUnits: MEDICATION_B.dose,
        type: SCHEDULED_MEDICATION,
        whoAdded: await getCurrentPractitionerFirstLastName(),
      });

      await medicationsPage.verifyMedicationInMedicationHistoryTable({
        medication: MEDICATION_C.name,
        doseUnits: MEDICATION_C.dose,
        type: AS_NEEDED_MEDICATION_DASH,
        whoAdded: await getCurrentPractitionerFirstLastName(),
      });

      await medicationsPage.verifyMedicationInMedicationHistoryTable({
        medication: MEDICATION_D.name,
        doseUnits: MEDICATION_D.dose,
        type: AS_NEEDED_MEDICATION_DASH,
        whoAdded: await getCurrentPractitionerFirstLastName(),
      });
    });

    let progressNotePage = await test.step('MED-1.3 Verify medications info on Progress note', async () => {
      const progressNotePage = await medicationsPage.sideMenu().clickReviewAndSign();
      await progressNotePage.verifyMedication(MEDICATION_A.name);
      await progressNotePage.verifyMedication(MEDICATION_B.name);
      await progressNotePage.verifyMedication(MEDICATION_C.name);
      await progressNotePage.verifyMedication(MEDICATION_D.name);
      return await expectInPersonProgressNotePage(page);
    });

    await test.step('MED-1.4 Delete medications and check they are removed from Medications container', async () => {
      medicationsPage = await progressNotePage.sideMenu().clickMedications();
      await medicationsPage.clickDeleteButton({ ...MEDICATION_A, type: 'scheduled' });
      await medicationsPage.verifyRemovedScheduledMedicationIsNotVisible(MEDICATION_A.name, MEDICATION_A.dose);
      await medicationsPage.verifyScheduledMedication(MEDICATION_B.name, MEDICATION_B.dose);
      await medicationsPage.verifyAsNeededMedication(MEDICATION_C.name, MEDICATION_C.dose);
      await medicationsPage.verifyAsNeededMedication(MEDICATION_D.name, MEDICATION_D.dose);

      await medicationsPage.clickDeleteButton({ ...MEDICATION_B, type: 'scheduled' });
      await medicationsPage.verifyRemovedScheduledMedicationIsNotVisible(MEDICATION_A.name, MEDICATION_A.dose);
      await medicationsPage.verifyRemovedScheduledMedicationIsNotVisible(MEDICATION_B.name, MEDICATION_B.dose);
      await medicationsPage.verifyAsNeededMedication(MEDICATION_C.name, MEDICATION_C.dose);
      await medicationsPage.verifyAsNeededMedication(MEDICATION_D.name, MEDICATION_D.dose);

      await medicationsPage.clickDeleteButton({ ...MEDICATION_C, type: 'as-needed' });
      await medicationsPage.verifyRemovedScheduledMedicationIsNotVisible(MEDICATION_A.name, MEDICATION_A.dose);
      await medicationsPage.verifyRemovedScheduledMedicationIsNotVisible(MEDICATION_B.name, MEDICATION_B.dose);
      await medicationsPage.verifyRemovedAsNeededMedicationIsNotVisible(MEDICATION_C.name, MEDICATION_C.dose);
      await medicationsPage.verifyAsNeededMedication(MEDICATION_D.name, MEDICATION_D.dose);

      await medicationsPage.clickDeleteButton({ ...MEDICATION_D, type: 'as-needed' });
      await medicationsPage.verifyRemovedScheduledMedicationIsNotVisible(MEDICATION_A.name, MEDICATION_A.dose);
      await medicationsPage.verifyRemovedScheduledMedicationIsNotVisible(MEDICATION_B.name, MEDICATION_B.dose);
      await medicationsPage.verifyRemovedAsNeededMedicationIsNotVisible(MEDICATION_C.name, MEDICATION_C.dose);
      await medicationsPage.verifyRemovedAsNeededMedicationIsNotVisible(MEDICATION_D.name, MEDICATION_D.dose);
    });

    await test.step('MED-1.5 Check deleted medications are not present in Medication History table', async () => {
      await medicationsPage.verifyRemovedMedicationIsNotPresentInMedicationHistoryTable({
        medication: MEDICATION_A.name,
        doseUnits: MEDICATION_A.dose,
        type: SCHEDULED_MEDICATION,
      });

      await medicationsPage.verifyRemovedMedicationIsNotPresentInMedicationHistoryTable({
        medication: MEDICATION_B.name,
        doseUnits: MEDICATION_B.dose,
        type: SCHEDULED_MEDICATION,
      });

      await medicationsPage.verifyRemovedMedicationIsNotPresentInMedicationHistoryTable({
        medication: MEDICATION_C.name,
        doseUnits: MEDICATION_C.dose,
        type: AS_NEEDED_MEDICATION_DASH,
      });

      await medicationsPage.verifyRemovedMedicationIsNotPresentInMedicationHistoryTable({
        medication: MEDICATION_D.name,
        doseUnits: MEDICATION_D.dose,
        type: AS_NEEDED_MEDICATION_DASH,
      });
    });

    await test.step('MED-1.6 Check deleted medications are not present on Progress note', async () => {
      progressNotePage = await medicationsPage.sideMenu().clickReviewAndSign();
      await progressNotePage.verifyRemovedMedicationIsNotShown(MEDICATION_B.name);
      await progressNotePage.verifyRemovedMedicationIsNotShown(MEDICATION_D.name);
      await progressNotePage.verifyRemovedMedicationIsNotShown(MEDICATION_A.name);
      await progressNotePage.verifyRemovedMedicationIsNotShown(MEDICATION_C.name);
    });

    await test.step('MED-1.7 Add medications note, check it is present on Medications page and on Progress note', async () => {
      medicationsPage = await progressNotePage.sideMenu().clickMedications();
      await medicationsPage.enterMedicationNote(MEDICATION_NOTE);
      await medicationsPage.clickAddMedicationNoteButton();
      await medicationsPage.verifyMedicationNote(MEDICATION_NOTE);
      progressNotePage = await medicationsPage.sideMenu().clickReviewAndSign();
      await progressNotePage.verifyMedicationNote(MEDICATION_NOTE);
    });

    await test.step('MED-1.8 Edit medications note, check edited note is present on Medications page and on Progress note', async () => {
      medicationsPage = await progressNotePage.sideMenu().clickMedications();
      const editDialog = await medicationsPage.clickEditNoteButton(MEDICATION_NOTE);
      await editDialog.verifyTitle('Edit Medication Note');
      await editDialog.clearNote();
      await editDialog.enterNote(MEDICATION_NOTE_EDITED);
      await editDialog.clickProceedButton();
      await medicationsPage.verifyMedicationNote(MEDICATION_NOTE_EDITED);
      progressNotePage = await medicationsPage.sideMenu().clickReviewAndSign();
      await progressNotePage.verifyMedicationNote(MEDICATION_NOTE_EDITED);
    });

    await test.step('MED-1.9 Remove medications note, check note is removed from Medications page and from Progress note', async () => {
      medicationsPage = await progressNotePage.sideMenu().clickMedications();
      const deleteDialog = await medicationsPage.clickDeleteNoteButton(MEDICATION_NOTE_EDITED);
      await deleteDialog.verifyTitle('Delete medication note');
      await deleteDialog.verifyModalContent('Are you sure you want to permanently delete this medication note?');
      await deleteDialog.verifyModalContent(MEDICATION_NOTE_EDITED);
      await deleteDialog.clickProceedButton();

      await medicationsPage.verifyRemovedMedicationNoteIsNotVisible(MEDICATION_NOTE_EDITED);
      progressNotePage = await medicationsPage.sideMenu().clickReviewAndSign();
      await progressNotePage.verifyRemovedMedicationNoteIsNotShown(MEDICATION_NOTE_EDITED);
    });
  });
});

async function setupPractitioners(page: Page): Promise<void> {
  const progressNotePage = new InPersonProgressNotePage(page);
  const inPersonHeader = new InPersonHeader(page);
  await page.goto(`in-person/${resourceHandler.appointment.id}/review-and-sign`);
  await inPersonHeader.verifyStatus('pending');
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  await progressNotePage.expectLoaded();
}

async function enterMedicationsInfo(medicationsInfo: MedicationsInfo, medicationsPage: MedicationsPage): Promise<void> {
  await medicationsPage.selectMedication(medicationsInfo.name);
  await medicationsPage.enterDoseUnits(medicationsInfo.dose);
  await medicationsPage.enterDateInput(medicationsInfo.date);
  await medicationsPage.clickAddButton();
}

async function getCurrentPractitionerFirstLastName(): Promise<string> {
  const testUserPractitioner = (await resourceHandler.getTestsUserAndPractitioner()).practitioner;
  return getLastName(testUserPractitioner) + ', ' + getFirstName(testUserPractitioner);
}
