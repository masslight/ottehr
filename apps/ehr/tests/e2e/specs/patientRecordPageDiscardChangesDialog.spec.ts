import { test } from '@playwright/test';
import { PATIENT_FIRST_NAME, ResourceHandler } from '../../e2e-utils/resource-handler';

import { expectPatientInformationPage, openPatientInformationPage } from '../page/PatientInformationPage';

import { expectDiscardChangesDialog } from '../page/patient-information/DiscardChangesDialog';
import { expectPatientRecordPage } from '../page/PatientRecordPage';
const NEW_PATIENT_FIRST_NAME = 'Test_firstname';

test.describe('Discard Changes Dialog non-mutating tests', () => {
  const resourceHandler = new ResourceHandler();

  test.beforeAll(async () => {
    await resourceHandler.setResources();
    await Promise.all([
      resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!),
      resourceHandler.waitTillHarvestingDone(resourceHandler.appointment.id!),
    ]);
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Click on [Discard changes] button, Patient Record page is opened', async ({ page }) => {
    let patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.clickCloseButton();
    const discardChangesDialog = await expectDiscardChangesDialog(page);
    await discardChangesDialog.clickDiscardChangesButton();
    await expectPatientRecordPage(resourceHandler.patient.id!, page);
    patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyPatientFirstName(PATIENT_FIRST_NAME);
  });

  test('Click on [Cancel] button, user stays on Patient Information page', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.clickCloseButton();
    const discardChangesDialog = await expectDiscardChangesDialog(page);
    await discardChangesDialog.clickCancelButton();
    await expectPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyPatientFirstName(NEW_PATIENT_FIRST_NAME);
  });

  test('Click on [x] icon, user stays on Patient Information page', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.clickCloseButton();
    const discardChangesDialog = await expectDiscardChangesDialog(page);
    await discardChangesDialog.clickCloseButton();
    await expectPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyPatientFirstName(NEW_PATIENT_FIRST_NAME);
  });
});
