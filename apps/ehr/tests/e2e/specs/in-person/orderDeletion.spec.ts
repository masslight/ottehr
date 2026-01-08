import { BrowserContext, expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DocumentProcedurePage, openDocumentProcedurePage } from 'tests/e2e/page/DocumentProcedurePage';
import { InHouseMedicationsPage } from 'tests/e2e/page/in-person/InHouseMedicationsPage';
import { expectAssessmentPage } from 'tests/e2e/page/in-person/InPersonAssessmentPage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { openOrderMedicationPage } from 'tests/e2e/page/OrderMedicationPage';
import { expectPatientInfoPage } from 'tests/e2e/page/PatientInfo';
import { ProceduresPage } from 'tests/e2e/page/ProceduresPage';
import {
  CreateRadiologyOrderPage,
  DeleteRadiologyOrderDialog,
  expectCreateRadiologyOrderPage,
  openRadiologyPage,
  RadiologyPage,
} from 'tests/e2e/page/RadiologyPage';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';
import {
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  medicationApplianceRoutes,
  radiologyStudiesConfig,
  UNIT_OPTIONS,
} from 'utils';
import InHouseMedicationsConfig from '../../../../../../config/oystehr/in-house-medications.json' assert { type: 'json' };
import procedureType from '../../../../../../config/oystehr/procedure-type.json' assert { type: 'json' };

const PROCESS_ID = `orderCancellation.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID);

// Helper function to get first available medication from config
function getFirstMedicationName(): string {
  const config = InHouseMedicationsConfig as any;
  const medicationKeys = Object.keys(config?.fhirResources || {});

  if (medicationKeys.length === 0) {
    throw new Error('No medications found in InHouseMedicationsConfig');
  }

  const firstKey = medicationKeys[0];
  const identifier = config.fhirResources[firstKey].resource.identifier.find(
    (id: { system: string; value: string }) => id.system === MEDICATION_IDENTIFIER_NAME_SYSTEM
  );

  if (!identifier?.value) {
    throw new Error('Medication identifier not found');
  }

  return identifier.value;
}

const PROCEDURE_TYPE_CODINGS = procedureType.fhirResources['value-set-procedure-type'].resource.expansion.contains;
const CONFIG_PROCEDURES = PROCEDURE_TYPE_CODINGS.map((procedure) => {
  const dropDownChoice = procedure.display;
  const codeableConcept = procedure.extension?.[0].valueCodeableConcept.coding[0];
  if (!codeableConcept) {
    return { dropDownChoice };
  }
  return {
    dropDownChoice,
    display: codeableConcept.code + '-' + codeableConcept.display, // Use dash as separator, matching UI format
    cptCode: codeableConcept.code,
    cptName: codeableConcept.display,
  };
});

// Find a procedure with a valid CPT code
const SELECTED_PROCEDURE = CONFIG_PROCEDURES.find((proc) => proc.cptCode) || CONFIG_PROCEDURES[0];
if (!SELECTED_PROCEDURE.cptCode) {
  throw new Error('No procedure with CPT code found in configuration');
}

// Test data constants
// cSpell:disable-next inversus
const DIAGNOSIS = 'Situs inversus';

// Procedures from config
const PROCEDURE_TYPE = SELECTED_PROCEDURE.dropDownChoice;
const PROCEDURE_CPT_CODE = SELECTED_PROCEDURE.cptCode;
const PROCEDURE_CPT_DISPLAY = SELECTED_PROCEDURE.display;

// Medications from config and utils
const MEDICATION_NAME = getFirstMedicationName(); // From in-house-medications.json
const MEDICATION_DOSE = '2'; // Test value
const MEDICATION_UNITS = UNIT_OPTIONS[0].label;
const MEDICATION_ROUTE = medicationApplianceRoutes.ORAL.display || 'Oral route';

// Radiology from component's default studies
const RADIOLOGY_STUDY = radiologyStudiesConfig[0];
if (!RADIOLOGY_STUDY?.display || !RADIOLOGY_STUDY?.code) {
  throw new Error('No radiology study with code and display found in defaultStudies');
}
const RADIOLOGY_STUDY_TYPE = RADIOLOGY_STUDY.display;
const RADIOLOGY_CLINICAL_HISTORY = 'Test clinical history for radiology order';

let page: Page;
let context: BrowserContext;
let sideMenu: SideMenu;

test.beforeAll(async ({ browser }) => {
  await resourceHandler.setResources({ skipPaperwork: true });
  await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

  context = await browser.newContext();
  page = await context.newPage();

  await setupPractitioners(page);

  sideMenu = new SideMenu(page);
});

test.afterAll(async () => {
  await page.close();
  await context.close();
  await resourceHandler.cleanupResources();
});

// Helper function to setup practitioners
async function setupPractitioners(page: Page): Promise<void> {
  const inPersonHeader = new InPersonHeader(page);
  await page.goto(`in-person/${resourceHandler.appointment.id}/progress-note`);
  await inPersonHeader.verifyStatus('pending');
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  await expectPatientInfoPage(page);
}

// Helper function to add vitals (required for medication orders)
async function addVitals(page: Page, weightKg: string, heightCm: string): Promise<void> {
  // Navigate to vitals page using side menu
  await page.getByTestId(dataTestIds.sideMenu.sideMenuItem('vitals')).click();
  await page.waitForURL(new RegExp('/vitals'));

  // Fill weight
  const weightInput = page.getByLabel('Weight (kg)');
  await weightInput.scrollIntoViewIfNeeded();
  await weightInput.fill(weightKg);

  // Click Add button using data-testid
  const weightAddButton = page.getByTestId(dataTestIds.vitalsPage.addWeightButton);
  await weightAddButton.click();

  // UI CHECK: Wait for weight to be saved - button becomes disabled again and value shows in history
  await expect(weightAddButton).toBeDisabled({ timeout: 10000 });
  const weightRegex = new RegExp(`${weightKg}(\\.0*)?\\s*kg`);
  await expect(page.getByText(weightRegex).first()).toBeVisible({ timeout: 10000 });

  // Fill height
  const heightInput = page.getByLabel('Height (cm)');
  await heightInput.scrollIntoViewIfNeeded();
  await heightInput.fill(heightCm);

  // Click Add button using data-testid
  const heightAddButton = page.getByTestId(dataTestIds.vitalsPage.addHeightButton);
  await heightAddButton.click();

  // UI CHECK: Wait for height to be saved - button becomes disabled again and value shows in history
  await expect(heightAddButton).toBeDisabled({ timeout: 10000 });
  const heightRegex = new RegExp(`${heightCm}(\\.0*)?\\s*cm`);
  await expect(page.getByText(heightRegex).first()).toBeVisible({ timeout: 10000 });

  // UI CHECK: Verify vitals alert is gone (vitals are now complete)
  await expect(page.getByRole('alert').filter({ hasText: /height or weight/i })).not.toBeVisible({
    timeout: 5000,
  });
}

test.describe('Order Deletion - Happy Path', () => {
  test('Delete procedure and verify it is removed from list', async () => {
    let proceduresPage: ProceduresPage;
    let documentProcedurePage: DocumentProcedurePage;

    await test.step('Create and document a procedure', async () => {
      // Navigate to assessment and add diagnosis
      await sideMenu.clickAssessment();
      const assessmentPage = await expectAssessmentPage(page);
      await assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS });

      // Verify diagnosis was added (UI check)
      await expect(page.getByText(DIAGNOSIS)).toBeVisible();

      // Open document procedure page directly
      documentProcedurePage = await openDocumentProcedurePage(resourceHandler.appointment.id!, page);
      await documentProcedurePage.setConsentForProcedureChecked(true);
      await documentProcedurePage.selectProcedureType(PROCEDURE_TYPE);
      await documentProcedurePage.selectCptCode(PROCEDURE_CPT_CODE);
      await documentProcedurePage.selectDiagnosis(DIAGNOSIS);

      // Click save and wait for redirect
      await documentProcedurePage.clickSaveButton();

      // Wait for URL change AND page to be fully loaded
      await page.waitForURL(new RegExp('/procedures'));
      await expect(page.getByTestId(dataTestIds.proceduresPage.title)).toBeVisible({ timeout: 10000 });

      // Create page object after page is fully loaded
      proceduresPage = new ProceduresPage(page);
    });

    await test.step('Verify procedure appears in list', async () => {
      // Page object already created and page is loaded - just verify procedure
      const procedureRow = proceduresPage.getProcedureRow(PROCEDURE_TYPE);
      await procedureRow.verifyProcedureType(PROCEDURE_TYPE);
      await procedureRow.verifyProcedureCptCode(PROCEDURE_CPT_DISPLAY);
    });

    await test.step('Delete the procedure', async () => {
      // Navigate back to procedures page
      await sideMenu.clickProcedures();

      // Wait for procedures page to fully load
      await page.waitForURL(new RegExp('/procedures'));
      await expect(page.getByTestId(dataTestIds.proceduresPage.title)).toBeVisible({ timeout: 30_000 });
      proceduresPage = new ProceduresPage(page);

      // Find the delete button in the procedure row and click it
      const procedureRow = page
        .getByTestId(dataTestIds.proceduresPage.procedureRow)
        .filter({ hasText: PROCEDURE_TYPE });

      await procedureRow
        .locator('button')
        .filter({ has: page.getByTestId('DeleteOutlinedIcon') })
        .click();

      // Wait for confirmation dialog to appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });

      // Confirm deletion in dialog
      const deleteButton = page.getByRole('button', { name: 'Delete Procedure' });
      await expect(deleteButton).toBeVisible({ timeout: 10000 });
      await deleteButton.click();

      // Wait for the dialog to close and verify success (UI check)
      await page.getByRole('dialog').waitFor({ state: 'detached' });
    });

    await test.step('Verify procedure is removed from list', async () => {
      // Wait for success alert to appear
      await expect(page.getByRole('alert').filter({ hasText: /deleted successfully/i })).toBeVisible({
        timeout: 10000,
      });

      // UI might need refresh - navigate back to procedures to reload the list
      await sideMenu.clickProcedures();
      await page.waitForURL(new RegExp('/procedures'));
      await expect(page.getByTestId(dataTestIds.proceduresPage.title)).toBeVisible({ timeout: 10000 });

      // Verify the deleted procedure is not in the list
      await expect(
        page.getByTestId(dataTestIds.proceduresPage.procedureRow).filter({ hasText: PROCEDURE_TYPE })
      ).not.toBeVisible();
    });

    await test.step('Verify procedure not shown in Progress Note', async () => {
      // Navigate to Review & Sign (Progress Note) page
      await sideMenu.clickReviewAndSign();

      // Wait for Progress Note page to load
      await page.waitForURL(new RegExp('/review-and-sign'));
      await expect(page.getByText('Progress Note')).toBeVisible({ timeout: 10000 });

      // Verify deleted procedure is not shown
      await expect(page.getByText(PROCEDURE_TYPE)).not.toBeVisible();
    });
  });

  test('Delete in-house medication and verify it is removed from list', async () => {
    let _inHouseMedicationsPage: InHouseMedicationsPage;
    let medicationId: string;

    await test.step('Add vitals (required for medication orders)', async () => {
      await addVitals(page, '70', '170');
    });

    await test.step('Add diagnosis for medication', async () => {
      // Navigate to assessment and add diagnosis
      await sideMenu.clickAssessment();
      const assessmentPage = await expectAssessmentPage(page);
      await assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS });

      // Verify diagnosis was added (UI check)
      await expect(page.getByText(DIAGNOSIS)).toBeVisible();
    });

    await test.step('Create a medication order', async () => {
      // Navigate directly to order medication page
      const orderMedicationPage = await openOrderMedicationPage(resourceHandler.appointment.id!, page);

      // Wait for Associated Dx field to load (skeleton to disappear)
      await orderMedicationPage.editMedicationCard.waitForLoadAssociatedDx();

      // Fill medication form using Page Object methods
      await orderMedicationPage.editMedicationCard.selectAssociatedDx(DIAGNOSIS);
      await orderMedicationPage.editMedicationCard.selectMedication(MEDICATION_NAME);
      await orderMedicationPage.editMedicationCard.enterDose(MEDICATION_DOSE);
      await orderMedicationPage.editMedicationCard.selectUnits(MEDICATION_UNITS);
      await orderMedicationPage.editMedicationCard.selectRoute(MEDICATION_ROUTE);

      // Wait for Ordered By field to load
      await orderMedicationPage.editMedicationCard.waitForLoadOrderedBy();

      // Click save button
      await orderMedicationPage.clickOrderMedicationButton();

      // UI CHECK: Verify medication was saved by checking URL changed to edit page
      await page.waitForURL(/\/in-house-medication\/order\/edit\//, { timeout: 15000 });

      // Extract medication ID from URL
      const url = page.url();
      const match = url.match(/\/in-house-medication\/order\/edit\/([^/?]+)/);
      if (!match) {
        throw new Error(`Failed to extract medication ID from URL: ${url}`);
      }
      medicationId = match[1];

      // Verify we're on Edit Order page
      await expect(page.getByRole('heading', { name: 'Edit Order', level: 1 })).toBeVisible({ timeout: 10000 });
    });

    await test.step('Verify medication appears in MAR', async () => {
      _inHouseMedicationsPage = await sideMenu.clickInHouseMedications();

      // Wait for MAR page to load
      await page.waitForURL(new RegExp('/in-house-medication/mar'));
      await expect(page.getByTestId(dataTestIds.inHouseMedicationsPage.title)).toBeVisible({ timeout: 10000 });

      // Wait for the loader to disappear (ensures data is fully loaded)
      // This prevents race conditions where we check for medications while data is still loading
      const loader = page.getByTestId(dataTestIds.inHouseMedicationsPage.marTableLoader);
      await loader.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {
        // Loader might not appear if data loads very quickly, which is fine
      });

      // Check that there's no error on the page
      await expect(page.getByText('An error has occurred')).not.toBeVisible();

      // First, wait for ANY medication row to appear in the table (confirms data loaded from backend)
      // Use data-testid pattern to find any medication row - this confirms table rendered and data arrived
      const anyMedicationRow = page.locator('[data-testid^="mar-table-medication-"]').first();
      await expect(anyMedicationRow).toBeVisible({ timeout: 30_000 });

      // Now verify the specific medication row we just created is visible
      await expect(
        page.getByTestId(dataTestIds.inHouseMedicationsPage.marTable.medicationRow(medicationId))
      ).toBeVisible();

      // Verify medication name is visible in the MAR table
      await expect(page.getByText(MEDICATION_NAME)).toBeVisible();
    });

    await test.step('Delete the medication', async () => {
      // Click on the medication row to open details
      await page.getByText(MEDICATION_NAME).click();

      // Wait for the medication details card to open and Delete Order button to be visible
      const deleteOrderButton = page.getByRole('button', { name: 'Delete Order' });
      await expect(deleteOrderButton).toBeVisible({ timeout: 10000 });

      // Click delete order button
      await deleteOrderButton.click();

      // Wait for the confirmation dialog to appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });

      // Confirm deletion in dialog
      const deleteButton = page.getByRole('button', { name: 'Delete Medication' });
      await expect(deleteButton).toBeVisible({ timeout: 10000 });
      await deleteButton.click();

      // UI CHECK: Wait for success alert and verify medication is removed from the page
      await expect(page.getByRole('alert').filter({ hasText: /deleted successfully/i })).toBeVisible({
        timeout: 10000,
      });

      // Wait for dialog to close (UI check)
      await page.getByRole('dialog').waitFor({ state: 'detached' });

      // UI CHECK: Verify medication disappeared from the current page
      await expect(page.getByText(MEDICATION_NAME)).not.toBeVisible();
    });

    await test.step('Verify medication is marked as cancelled in MAR', async () => {
      // Navigate back to MAR
      await sideMenu.clickInHouseMedications();

      // Wait for MAR page to load
      await page.waitForURL(new RegExp('/in-house-medication/mar'));
      await expect(page.getByTestId(dataTestIds.inHouseMedicationsPage.title)).toBeVisible({ timeout: 10000 });

      // Wait for the loader to disappear (ensures data is fully loaded)
      const loader = page.getByTestId(dataTestIds.inHouseMedicationsPage.marTableLoader);
      await loader.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {
        // Loader might not appear if data loads very quickly, which is fine
      });

      // Verify medication is visible in MAR with "Cancelled" status
      // (Cancelled medications now appear in the "Completed" section for backward compatibility)
      const medicationRow = page.getByTestId(dataTestIds.inHouseMedicationsPage.marTable.medicationRow(medicationId));

      await expect(medicationRow).toBeVisible({ timeout: 30_000 });

      // Verify the status is "Cancelled"
      await expect(medicationRow.getByTestId(dataTestIds.inHouseMedicationsPage.marTable.statusCell)).toContainText(
        'Cancelled',
        { timeout: 30_000 }
      );
    });

    await test.step('Verify medication not shown in Progress Note', async () => {
      // Navigate to Review & Sign (Progress Note) page
      await sideMenu.clickReviewAndSign();

      // Wait for Progress Note page to load
      await page.waitForURL(new RegExp('/review-and-sign'));
      await expect(page.getByText('Progress Note')).toBeVisible({ timeout: 10000 });

      // Verify deleted medication is not shown
      await expect(page.getByText(MEDICATION_NAME)).not.toBeVisible();
    });
  });

  test('Delete radiology order and verify it is removed from list', async () => {
    let radiologyPage: RadiologyPage;
    let createRadiologyOrderPage: CreateRadiologyOrderPage;
    let serviceRequestId: string;

    await test.step('Add vitals (may be required for orders)', async () => {
      await addVitals(page, '70', '170');
    });

    await test.step('Add diagnosis for radiology', async () => {
      // Navigate to assessment and add diagnosis
      await sideMenu.clickAssessment();
      const assessmentPage = await expectAssessmentPage(page);
      await assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS });

      // Verify diagnosis was added (UI check)
      await expect(page.getByText(DIAGNOSIS)).toBeVisible();
    });

    await test.step('Create a radiology order', async () => {
      // Navigate to radiology page
      radiologyPage = await openRadiologyPage(resourceHandler.appointment.id!, page);

      // Click Order button
      await radiologyPage.clickOrderButton();

      // Fill out the order form
      createRadiologyOrderPage = await expectCreateRadiologyOrderPage(page);
      await createRadiologyOrderPage.selectStudyType(RADIOLOGY_STUDY_TYPE);
      await createRadiologyOrderPage.selectDiagnosis(DIAGNOSIS);
      await createRadiologyOrderPage.fillClinicalHistory(RADIOLOGY_CLINICAL_HISTORY);
      await createRadiologyOrderPage.clickSubmitButton();

      // Verify redirect back to radiology list (UI check)
      await page.waitForURL(new RegExp('/radiology$'));
      await expect(page.getByTestId(dataTestIds.radiologyPage.title)).toBeVisible({ timeout: 10000 });

      // Wait for at least one radiology order row to appear (with longer timeout for backend sync)
      // Use data-testid pattern to find any radiology order row
      const orderRow = page.locator('[data-testid^="radiology-order-row-"]').first();
      await expect(orderRow).toBeVisible({ timeout: 60000 });

      // Extract serviceRequestId from the row's data-testid
      const testId = await orderRow.getAttribute('data-testid');
      if (!testId) {
        throw new Error('Failed to extract serviceRequestId from radiology order row');
      }
      // data-testid format: "radiology-order-row-{serviceRequestId}"
      serviceRequestId = testId.replace('radiology-order-row-', '');
    });

    await test.step('Verify radiology order appears in list', async () => {
      // Verify the specific order is visible by its serviceRequestId
      await expect(page.getByTestId(dataTestIds.radiologyPage.radiologyOrderRow(serviceRequestId))).toBeVisible();
    });

    await test.step('Delete the radiology order', async () => {
      // Click delete button using the extracted serviceRequestId
      await page.getByTestId(dataTestIds.radiologyPage.deleteOrderButton(serviceRequestId)).click();

      // Wait for confirmation dialog to appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });

      // Confirm deletion in dialog
      const deleteDialog = new DeleteRadiologyOrderDialog(page);
      await deleteDialog.confirmDelete();

      // Wait for dialog to close and verify success (UI check)
      await page.getByRole('dialog').waitFor({ state: 'detached' });
    });

    await test.step('Verify radiology order is removed from list', async () => {
      // Wait for the specific order row to be removed from the list after deletion (by serviceRequestId)
      await page
        .getByTestId(dataTestIds.radiologyPage.radiologyOrderRow(serviceRequestId))
        .waitFor({ state: 'detached', timeout: 10000 });

      // Verify the deleted order is not visible
      // (The component filters out orders with status 'revoked')
      await expect(page.getByTestId(dataTestIds.radiologyPage.radiologyOrderRow(serviceRequestId))).not.toBeVisible();
    });

    await test.step('Verify radiology order not shown in Progress Note', async () => {
      // Navigate to Review & Sign (Progress Note) page
      await sideMenu.clickReviewAndSign();

      // Wait for Progress Note page to load
      await page.waitForURL(new RegExp('/review-and-sign'));
      await expect(page.getByText('Progress Note')).toBeVisible({ timeout: 10000 });

      // Verify deleted radiology order is not shown (check by CPT code which is stable)
      await expect(page.getByText(RADIOLOGY_STUDY.code!)).not.toBeVisible();
    });
  });
});
