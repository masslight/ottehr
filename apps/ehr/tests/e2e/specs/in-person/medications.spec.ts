import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import {
  expectInPersonProgressNotePage,
  InPersonProgressNotePage,
  openInPersonProgressNotePage,
} from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { MedicationsPage } from 'tests/e2e/page/in-person/MedicationsPage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';
import { getFirstName, getLastName } from 'utils';

const resourceHandler = new ResourceHandler(`screening-mutating-${DateTime.now().toMillis()}`);

interface MedicationsInfo {
  medication: string;
  doseUnits: string;
  date: string;
}

const MEDICATION_A: MedicationsInfo = {
  medication: 'Warfarin Sodium  Powder',
  doseUnits: '1 mg',
  date: '11/28/2025 01:00 PM',
};

const MEDICATION_B: MedicationsInfo = {
  medication: 'Albuterol Sulfate  Powder',
  doseUnits: '10 g',
  date: '01/01/2025 03:00 PM',
};

const MEDICATION_C: MedicationsInfo = {
  medication: 'Water Oral Oral Liquid',
  doseUnits: '2 mg',
  date: '02/02/2025 02:00 PM',
};

const MEDICATION_D: MedicationsInfo = {
  medication: 'Banana Cream Flavor  Liquid',
  doseUnits: '5 mg',
  date: '03/03/2025 05:00 PM',
};

const SCHEDULED_MEDICATION = 'Scheduled medication';
const AS_NEEDED_MEDICATION = 'As needed medication';
const AS_NEEDED_MEDICATION_DASH = 'As-needed medication';

test.describe('Medications Page mutating tests', () => {
  test.beforeEach(async ({ page }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
    await setupPractitioners(page);
  });

  test.afterEach(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Create scheduled medication happy path', async ({ page }) => {
    let progressNotePage = await expectInPersonProgressNotePage(page);
    let medicationsPage = await progressNotePage.sideMenu().clickMedications();
    await medicationsPage.selectScheduledMedication(SCHEDULED_MEDICATION);
    await enterMedicationsInfo(MEDICATION_A, medicationsPage);
    await medicationsPage.verifyScheduledMedication(MEDICATION_A.medication, MEDICATION_A.doseUnits);
    await enterMedicationsInfo(MEDICATION_B, medicationsPage);
    await medicationsPage.verifyScheduledMedication(MEDICATION_A.medication, MEDICATION_A.doseUnits);
    await medicationsPage.verifyScheduledMedication(MEDICATION_B.medication, MEDICATION_B.doseUnits);
    await medicationsPage.selectAsNeededMedication(AS_NEEDED_MEDICATION);
    await enterMedicationsInfo(MEDICATION_C, medicationsPage);
    await medicationsPage.verifyScheduledMedication(MEDICATION_A.medication, MEDICATION_A.doseUnits);
    await medicationsPage.verifyScheduledMedication(MEDICATION_B.medication, MEDICATION_B.doseUnits);
    await medicationsPage.verifyAsNeddedMedication(MEDICATION_C.medication, MEDICATION_C.doseUnits);
    await medicationsPage.selectAsNeededMedication(AS_NEEDED_MEDICATION);
    await enterMedicationsInfo(MEDICATION_D, medicationsPage);
    await medicationsPage.verifyScheduledMedication(MEDICATION_A.medication, MEDICATION_A.doseUnits);
    await medicationsPage.verifyScheduledMedication(MEDICATION_B.medication, MEDICATION_B.doseUnits);
    await medicationsPage.verifyAsNeddedMedication(MEDICATION_C.medication, MEDICATION_C.doseUnits);
    await medicationsPage.verifyAsNeddedMedication(MEDICATION_D.medication, MEDICATION_D.doseUnits);

    //check orders are present in Medication history table
    await medicationsPage.clickSeeMoreButton();
    await medicationsPage.verifyMedicationInMedicationHistoryTable({
      medication: MEDICATION_A.medication,
      doseUnits: MEDICATION_A.doseUnits,
      type: SCHEDULED_MEDICATION,
      whoAdded: await getCurrentPractitionerFirstLastName(),
    });

    await medicationsPage.verifyMedicationInMedicationHistoryTable({
      medication: MEDICATION_B.medication,
      doseUnits: MEDICATION_B.doseUnits,
      type: SCHEDULED_MEDICATION,
      whoAdded: await getCurrentPractitionerFirstLastName(),
    });

    await medicationsPage.verifyMedicationInMedicationHistoryTable({
      medication: MEDICATION_C.medication,
      doseUnits: MEDICATION_C.doseUnits,
      type: AS_NEEDED_MEDICATION_DASH,
      whoAdded: await getCurrentPractitionerFirstLastName(),
    });

    await medicationsPage.verifyMedicationInMedicationHistoryTable({
      medication: MEDICATION_D.medication,
      doseUnits: MEDICATION_D.doseUnits,
      type: AS_NEEDED_MEDICATION_DASH,
      whoAdded: await getCurrentPractitionerFirstLastName(),
    });
    // check orders on Progress note
    progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyMedication(MEDICATION_A.medication);

    progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyMedication(MEDICATION_B.medication);

    progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyMedication(MEDICATION_C.medication);

    progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyMedication(MEDICATION_D.medication);

    // Delete the order and verify it isn't present in the list, in med history table and in progress note

    medicationsPage = await progressNotePage.sideMenu().clickMedications();
    await medicationsPage.clickDeleteButton(MEDICATION_A.medication, MEDICATION_A.doseUnits);
    await medicationsPage.clickDeleteButton(MEDICATION_C.medication, MEDICATION_C.doseUnits);

    await medicationsPage.verifyScheduledMedication(MEDICATION_B.medication, MEDICATION_B.doseUnits);
    await medicationsPage.verifyAsNeddedMedication(MEDICATION_D.medication, MEDICATION_D.doseUnits);
    await medicationsPage.verifyRemovedScheduledMedicationIsNotVisible(MEDICATION_A.medication, MEDICATION_A.doseUnits);
    await medicationsPage.verifyRemovedAsNeddedMedicationIsNotVisible(MEDICATION_C.medication, MEDICATION_C.doseUnits);

    await medicationsPage.verifyRemovedMedicationIsNotPresentInMedicationHistoryTable({
      medication: MEDICATION_A.medication,
      doseUnits: MEDICATION_A.doseUnits,
      type: SCHEDULED_MEDICATION,
    });

    await medicationsPage.verifyRemovedMedicationIsNotPresentInMedicationHistoryTable({
      medication: MEDICATION_C.medication,
      doseUnits: MEDICATION_C.doseUnits,
      type: SCHEDULED_MEDICATION,
    });
    await medicationsPage.verifyMedicationInMedicationHistoryTable({
      medication: MEDICATION_B.medication,
      doseUnits: MEDICATION_B.doseUnits,
      type: SCHEDULED_MEDICATION,
      whoAdded: await getCurrentPractitionerFirstLastName(),
    });

    await medicationsPage.verifyMedicationInMedicationHistoryTable({
      medication: MEDICATION_D.medication,
      doseUnits: MEDICATION_D.doseUnits,
      type: AS_NEEDED_MEDICATION_DASH,
      whoAdded: await getCurrentPractitionerFirstLastName(),
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
  await medicationsPage.selectMedication(medicationsInfo.medication);
  await medicationsPage.enterDoseUnits(medicationsInfo.doseUnits);
  await medicationsPage.enterDateInput(medicationsInfo.date);
  await medicationsPage.clickAddButton();
}

async function getCurrentPractitionerFirstLastName(): Promise<string> {
  const testUserPractitioner = (await resourceHandler.getTestsUserAndPractitioner()).practitioner;
  return getLastName(testUserPractitioner) + ', ' + getFirstName(testUserPractitioner);
}
