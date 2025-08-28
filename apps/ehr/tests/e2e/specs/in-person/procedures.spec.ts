import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { CssHeader } from 'tests/e2e/page/CssHeader';
import { openDocumentProcedurePage } from 'tests/e2e/page/DocumentProcedurePage';
import {
  InPersonProgressNotePage,
  openInPersonProgressNotePage,
} from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { expectProceduresPage } from 'tests/e2e/page/ProceduresPage';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';

const resourceHandler = new ResourceHandler(`documentProceduresPage-mutating-${DateTime.now().toMillis()}`);
const WOUND_CARE_PROCEDURE_TYPE = 'Wound Care / Dressing Change';
const X_RAY_CPT_CODE = '73000';
const X_RAY_CPT_NAME = 'X-ray of collar bone';
const B12_DIAGNOSIS_CODE = 'D51.0';
const B12_DIAGNOSIS_NAME = 'Vitamin B12 deficiency anemia due to intrinsic factor deficiency';
const HEALTH_CARE_STUFF = 'Healthcare staff';
const TOPICAL = 'Topical';
const ARM = 'Arm';
const LEFT = 'Left';
const STERILE = 'Sterile';
const SPLINT = 'Splint';
const PROCEDURE_DETAILS = 'test details';
const YES = 'Yes';
const BLEEDING = 'Bleeding';
const STABLE = 'Stable';
const RETURN_IF_WORSENING = 'Return if worsening';
const LESS_5_MIN = '< 5 min';
const PROVIDER = 'Provider';

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
    const documentProcedurePage = await openDocumentProcedurePage(resourceHandler.appointment.id!, page);
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

    const proceduresPage = await expectProceduresPage(page);
    const procedureRow = proceduresPage.getProcedureRow(WOUND_CARE_PROCEDURE_TYPE);
    await procedureRow.verifyProcedureCptCode(X_RAY_CPT_CODE + '-' + X_RAY_CPT_NAME);
    await procedureRow.verifyProcedureType(WOUND_CARE_PROCEDURE_TYPE);
    await procedureRow.verifyProcedureDiagnosis(B12_DIAGNOSIS_CODE + '-' + B12_DIAGNOSIS_NAME);
    await procedureRow.verifyProcedureDocumentedBy(PROVIDER);

    const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
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

    // todo open procedure page

    /*await documentProcedurePage.verifyProcedureType(WOUND_CARE_PROCEDURE_TYPE);
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
    await documentProcedurePage.verifyDocumentedBy(PROVIDER);*/

    // todo edit procedure and save

    // todo verify progress note
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
