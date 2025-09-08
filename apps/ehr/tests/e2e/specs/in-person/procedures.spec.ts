import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { CssHeader } from 'tests/e2e/page/CssHeader';
import { openDocumentProcedurePage } from 'tests/e2e/page/DocumentProcedurePage';
import {
  InPersonProgressNotePage,
  openInPersonProgressNotePage,
} from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { expectProceduresPage, openProceduresPage } from 'tests/e2e/page/ProceduresPage';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';

const resourceHandler = new ResourceHandler(`documentProceduresPage-mutating-${DateTime.now().toMillis()}`);
const WOUND_CARE_PROCEDURE_TYPE = 'Wound Care / Dressing Change';
const SPLINT_APPLICATION_PROCEDURE_TYPE = 'Splint Application / Immobilization';
const X_RAY_CPT_CODE = '73000';
const INJECTION_CPT_CODE = '11900';
const X_RAY_CPT_NAME = 'X-ray of collar bone';
const INJECTION_CPT_NAME = 'Injection into skin growth, 1-7 growths';
const B12_DIAGNOSIS_CODE = 'D51.0';
const FEVER_DIAGNOSIS_CODE = 'R50.9';
const B12_DIAGNOSIS_NAME = 'Vitamin B12 deficiency anemia due to intrinsic factor deficiency';
const FEVER_DIAGNOSIS_NAME = 'Fever, unspecified';
const HEALTH_CARE_STUFF = 'Healthcare staff';
const BOTH = 'Both';
const TOPICAL = 'Topical';
const LOCAL = 'Local';
const ARM = 'Arm';
const FACE = 'Face';
const LEFT = 'Left';
const NOT_APPLICABLE = 'Not Applicable';
const STERILE = 'Sterile';
const CLEAN = 'Clean';
const SPLINT = 'Splint';
const SPECULUM = 'Speculum';
const PROCEDURE_DETAILS = 'test details';
const PROCEDURE_DETAILS_2 = 'test details_edited';
const YES = 'Yes';
const NO = 'No';
const BLEEDING = 'Bleeding';
const ALLERGIC_REACTION = 'Allergic Reaction';
const STABLE = 'Stable';
const IMPROVED = 'Improved';
const RETURN_IF_WORSENING = 'Return if worsening';
const WOUND_CARE = 'Wound Care';
const LESS_5_MIN = '< 5 min';
const MORE_30_MIN = '> 30 min';
const PROVIDER = 'Provider';
const HEALTHCARE_STAFF = 'healthcare_staff';

test.describe('Document Procedures Page mutating tests', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.INTEGRATION_TEST === 'true') {
      await resourceHandler.setResourcesFast();
    } else {
      await resourceHandler.setResources();
      await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
    }
    await setupPractitioners(page);
  });

  test.afterEach(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Fill and save all values on Document Procedures Page, values are saved and updated successfully- Happy path', async ({
    page,
  }) => {
    let documentProcedurePage = await openDocumentProcedurePage(resourceHandler.appointment.id!, page);
    await documentProcedurePage.checkConsentForProcedure();
    await documentProcedurePage.selectProcedureType(WOUND_CARE_PROCEDURE_TYPE);
    await documentProcedurePage.selectCptCode(X_RAY_CPT_CODE);
    await documentProcedurePage.selectDiagnosis(B12_DIAGNOSIS_CODE);
    await documentProcedurePage.selectPerformedBy(HEALTH_CARE_STUFF);
    await documentProcedurePage.selectAnaesthesia(TOPICAL);
    await documentProcedurePage.selectSite(ARM);
    await documentProcedurePage.selectSideOfBody(LEFT);
    await documentProcedurePage.selectTechnique(STERILE);
    await documentProcedurePage.selectInstruments(SPLINT);
    await documentProcedurePage.enterProcedureDetails(PROCEDURE_DETAILS);
    await documentProcedurePage.selectSpecimenSent(YES);
    await documentProcedurePage.selectComplications(BLEEDING);
    await documentProcedurePage.selectPatientResponse(STABLE);
    await documentProcedurePage.selectPostProcedureInstructions(RETURN_IF_WORSENING);
    await documentProcedurePage.selectTimeSpent(LESS_5_MIN);
    await documentProcedurePage.selectDocumentedBy(PROVIDER);
    await documentProcedurePage.clickSaveButton();

    let proceduresPage = await expectProceduresPage(page);
    let procedureRow = proceduresPage.getProcedureRow(WOUND_CARE_PROCEDURE_TYPE);
    await procedureRow.verifyProcedureCptCode(X_RAY_CPT_CODE + '-' + X_RAY_CPT_NAME);
    await procedureRow.verifyProcedureType(WOUND_CARE_PROCEDURE_TYPE);
    await procedureRow.verifyProcedureDiagnosis(B12_DIAGNOSIS_CODE + '-' + B12_DIAGNOSIS_NAME);
    await procedureRow.verifyProcedureDocumentedBy(PROVIDER);

    let progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyProcedure(WOUND_CARE_PROCEDURE_TYPE, [
      'CPT: ' + X_RAY_CPT_CODE + ' ' + X_RAY_CPT_NAME,
      'Dx: ' + B12_DIAGNOSIS_CODE + ' ' + B12_DIAGNOSIS_NAME,
      'Performed by: ' + HEALTH_CARE_STUFF,
      'Anaesthesia / medication used: ' + TOPICAL,
      'Site/location: ' + ARM,
      'Side of body: ' + LEFT,
      'Technique: ' + STERILE,
      'Instruments / supplies used: ' + SPLINT,
      'Procedure details: ' + PROCEDURE_DETAILS,
      'Specimen sent: ' + YES,
      'Complications: ' + BLEEDING,
      'Patient response: ' + STABLE,
      'Post-procedure instructions: ' + RETURN_IF_WORSENING,
      'Time spent: ' + LESS_5_MIN,
      'Documented by: ' + PROVIDER,
    ]);

    proceduresPage = await openProceduresPage(resourceHandler.appointment.id!, page);
    procedureRow = proceduresPage.getProcedureRow(WOUND_CARE_PROCEDURE_TYPE);
    documentProcedurePage = await procedureRow.click();
    await documentProcedurePage.verifyConsentForProcedureChecked(true);
    await documentProcedurePage.verifyProcedureType(WOUND_CARE_PROCEDURE_TYPE);
    await documentProcedurePage.verifyCptCode(X_RAY_CPT_CODE + ' ' + X_RAY_CPT_NAME);
    await documentProcedurePage.verifyDiagnosis(B12_DIAGNOSIS_NAME + ' ' + B12_DIAGNOSIS_CODE);
    await documentProcedurePage.verifyPerformedBy(HEALTH_CARE_STUFF);
    await documentProcedurePage.verifyAnaesthesia(TOPICAL);
    await documentProcedurePage.verifySite(ARM);
    await documentProcedurePage.verifySideOfBody(LEFT);
    await documentProcedurePage.verifyTechnique(STERILE);
    await documentProcedurePage.verifyInstruments(SPLINT);
    await documentProcedurePage.verifyProcedureDetails(PROCEDURE_DETAILS);
    await documentProcedurePage.verifySpecimenSent(YES);
    await documentProcedurePage.verifyComplications(BLEEDING);
    await documentProcedurePage.verifyPatientResponse(STABLE);
    await documentProcedurePage.verifyPostProcedureInstructions(RETURN_IF_WORSENING);
    await documentProcedurePage.verifyTimeSpent(LESS_5_MIN);
    await documentProcedurePage.verifyDocumentedBy(PROVIDER);

    await documentProcedurePage.uncheckConsentForProcedure();
    await documentProcedurePage.selectProcedureType(SPLINT_APPLICATION_PROCEDURE_TYPE);
    await documentProcedurePage.selectCptCode(INJECTION_CPT_CODE);
    await documentProcedurePage.selectDiagnosis(FEVER_DIAGNOSIS_CODE);
    await documentProcedurePage.selectPerformedBy(BOTH);
    await documentProcedurePage.selectAnaesthesia(LOCAL);
    await documentProcedurePage.selectSite(FACE);
    await documentProcedurePage.selectSideOfBody(NOT_APPLICABLE);
    await documentProcedurePage.selectTechnique(CLEAN);
    await documentProcedurePage.selectInstruments(SPECULUM);
    await documentProcedurePage.enterProcedureDetails(PROCEDURE_DETAILS_2);
    await documentProcedurePage.selectSpecimenSent(NO);
    await documentProcedurePage.selectComplications(ALLERGIC_REACTION);
    await documentProcedurePage.selectPatientResponse(IMPROVED);
    await documentProcedurePage.selectPostProcedureInstructions(WOUND_CARE);
    await documentProcedurePage.selectTimeSpent(MORE_30_MIN);
    await documentProcedurePage.selectDocumentedBy(HEALTHCARE_STAFF);
    await documentProcedurePage.clickSaveButton();

    proceduresPage = await expectProceduresPage(page);
    procedureRow = proceduresPage.getProcedureRow(SPLINT_APPLICATION_PROCEDURE_TYPE);
    await procedureRow.verifyProcedureCptCode(INJECTION_CPT_CODE + '-' + INJECTION_CPT_NAME);
    await procedureRow.verifyProcedureType(SPLINT_APPLICATION_PROCEDURE_TYPE);
    await procedureRow.verifyProcedureDiagnosis(FEVER_DIAGNOSIS_CODE + '-' + FEVER_DIAGNOSIS_NAME);
    await procedureRow.verifyProcedureDocumentedBy(HEALTHCARE_STAFF);

    progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyProcedure(SPLINT_APPLICATION_PROCEDURE_TYPE, [
      'CPT: ' + INJECTION_CPT_CODE + ' ' + INJECTION_CPT_NAME,
      'Dx: ' + FEVER_DIAGNOSIS_CODE + ' ' + FEVER_DIAGNOSIS_NAME,
      'Performed by: ' + BOTH,
      'Anaesthesia / medication used: ' + LOCAL,
      'Site/location: ' + FACE,
      'Side of body: ' + NOT_APPLICABLE,
      'Technique: ' + CLEAN,
      'Instruments / supplies used: ' + SPECULUM,
      'Procedure details: ' + PROCEDURE_DETAILS_2,
      'Specimen sent: ' + NO,
      'Complications: ' + ALLERGIC_REACTION,
      'Patient response: ' + IMPROVED,
      'Post-procedure instructions: ' + WOUND_CARE,
      'Time spent: ' + MORE_30_MIN,
      'Documented by: ' + HEALTHCARE_STAFF,
    ]);

    proceduresPage = await openProceduresPage(resourceHandler.appointment.id!, page);
    procedureRow = proceduresPage.getProcedureRow(WOUND_CARE_PROCEDURE_TYPE);
    documentProcedurePage = await procedureRow.click();
    await documentProcedurePage.verifyProcedureType(SPLINT_APPLICATION_PROCEDURE_TYPE);
    await documentProcedurePage.verifyCptCode(INJECTION_CPT_CODE);
    await documentProcedurePage.verifyDiagnosis(FEVER_DIAGNOSIS_CODE);
    await documentProcedurePage.verifyPerformedBy(BOTH);
    await documentProcedurePage.verifyAnaesthesia(LOCAL);
    await documentProcedurePage.verifySite(FACE);
    await documentProcedurePage.verifySideOfBody(NOT_APPLICABLE);
    await documentProcedurePage.verifyTechnique(CLEAN);
    await documentProcedurePage.verifyInstruments(SPECULUM);
    await documentProcedurePage.verifyProcedureDetails(PROCEDURE_DETAILS_2);
    await documentProcedurePage.verifySpecimenSent(NO);
    await documentProcedurePage.verifyComplications(ALLERGIC_REACTION);
    await documentProcedurePage.verifyPatientResponse(IMPROVED);
    await documentProcedurePage.verifyPostProcedureInstructions(WOUND_CARE);
    await documentProcedurePage.verifyTimeSpent(MORE_30_MIN);
    await documentProcedurePage.verifyDocumentedBy(HEALTHCARE_STAFF);

    // todo open procedure page
    // todo verify procedure edited
  });

  async function setupPractitioners(page: Page): Promise<void> {
    const progressNotePage = new InPersonProgressNotePage(page);
    const cssHeader = new CssHeader(page);
    await page.goto(`in-person/${resourceHandler.appointment.id}/progress-note`);
    await cssHeader.verifyStatus('pending');
    await cssHeader.selectIntakePractitioner();
    await cssHeader.selectProviderPractitioner();
    await cssHeader.clickSwitchModeButton('provider');
    await progressNotePage.expectLoaded();
  }
});
