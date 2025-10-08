import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import {
  DocumentProcedurePage,
  expectDocumentProcedurePage,
  openDocumentProcedurePage,
} from 'tests/e2e/page/DocumentProcedurePage';
import {
  InPersonProgressNotePage,
  openInPersonProgressNotePage,
} from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { openProceduresPage, ProcedureRow } from 'tests/e2e/page/ProceduresPage';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';

interface ProcedureInfo {
  consentChecked: boolean;
  procedureType: string;
  cptCode: string;
  cptName: string;
  diagnosisCode: string;
  diagnosisName: string;
  performedBy: string;
  anaesthesia: string;
  bodySite: string;
  bodySide: string;
  technique: string;
  instruments: string;
  details: string;
  specimentSent: string;
  complication: string;
  patinentResponse: string;
  instructions: string;
  timeSpent: string;
  documentedBy: string;
}

const PROCEDURE_A: ProcedureInfo = {
  consentChecked: true,
  procedureType: 'Wound Care / Dressing Change',
  cptCode: '73000',
  cptName: 'X-ray of collar bone',
  diagnosisCode: 'D51.0',
  diagnosisName: 'Vitamin B12 deficiency anemia due to intrinsic factor deficiency',
  performedBy: 'Healthcare staff',
  anaesthesia: 'Topical',
  bodySite: 'Arm',
  bodySide: 'Left',
  technique: 'Sterile',
  instruments: 'Splint',
  details: 'test details a',
  specimentSent: 'Yes',
  complication: 'Bleeding',
  patinentResponse: 'Stable',
  instructions: 'Return if worsening',
  timeSpent: '< 5 min',
  documentedBy: 'Provider',
};

const PROCEDURE_B: ProcedureInfo = {
  consentChecked: false,
  procedureType: 'Splint Application / Immobilization',
  cptCode: '11900',
  cptName: 'Injection into skin growth, 1-7 growths',
  diagnosisCode: 'R50.9',
  diagnosisName: 'Fever, unspecified',
  performedBy: 'Both',
  anaesthesia: 'Local',
  bodySite: 'Face',
  bodySide: 'Not Applicable',
  technique: 'Clean',
  instruments: 'Speculum',
  details: 'test details b',
  specimentSent: 'No',
  complication: 'Allergic Reaction',
  patinentResponse: 'Improved',
  instructions: 'Wound Care',
  timeSpent: '> 30 min',
  documentedBy: 'Healthcare staff',
};

const resourceHandler = new ResourceHandler(`documentProceduresPage-mutating-${DateTime.now().toMillis()}`);

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

  test('Procedures happy path', async ({ page }) => {
    await test.step('Create a procedure', async () => {
      const documentProcedurePage = await openDocumentProcedurePage(resourceHandler.appointment.id!, page);
      await enterProcedureInfo(PROCEDURE_A, documentProcedurePage);
      const proceduresPage = await documentProcedurePage.clickSaveButton();
      const procedureRow = proceduresPage.getProcedureRow(PROCEDURE_A.procedureType);
      await verifyProcedureRow(PROCEDURE_A, procedureRow);
    });

    await test.step('Verify prodecure details on progress note', async () => {
      const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
      await progressNotePage.verifyProcedure(PROCEDURE_A.procedureType, progressNoteProcedureDetails(PROCEDURE_A));
    });

    await test.step('Verify prodecure details on procedure details page', async () => {
      const proceduresPage = await openProceduresPage(resourceHandler.appointment.id!, page);
      const documentProcedurePage = await proceduresPage.getProcedureRow(PROCEDURE_A.procedureType).click();
      await verifyProcedureInfo(PROCEDURE_A, documentProcedurePage);
    });

    await test.step('Edit the procedure', async () => {
      const documentProcedurePage = await expectDocumentProcedurePage(page);
      await enterProcedureInfo(PROCEDURE_B, documentProcedurePage);
      await documentProcedurePage.deleteDiagnosis(PROCEDURE_A.diagnosisName + ' ' + PROCEDURE_A.diagnosisCode);
      const proceduresPage = await documentProcedurePage.clickSaveButton();
      const procedureRow = proceduresPage.getProcedureRow(PROCEDURE_B.procedureType);
      await verifyProcedureRow(PROCEDURE_B, procedureRow);
    });

    await test.step('Verify edited prodecure details on progress note', async () => {
      const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
      await progressNotePage.verifyProcedure(PROCEDURE_B.procedureType, progressNoteProcedureDetails(PROCEDURE_B));
    });

    await test.step('Verify edited prodecure details on procedure details page', async () => {
      const proceduresPage = await openProceduresPage(resourceHandler.appointment.id!, page);
      const procedureRow = proceduresPage.getProcedureRow(PROCEDURE_B.procedureType);
      const documentProcedurePage = await procedureRow.click();
      await verifyProcedureInfo(PROCEDURE_B, documentProcedurePage);
    });
  });

  async function setupPractitioners(page: Page): Promise<void> {
    const progressNotePage = new InPersonProgressNotePage(page);
    const inPersonHeader = new InPersonHeader(page);
    await page.goto(`in-person/${resourceHandler.appointment.id}/progress-note`);
    await inPersonHeader.verifyStatus('pending');
    await inPersonHeader.selectIntakePractitioner();
    await inPersonHeader.selectProviderPractitioner();
    await inPersonHeader.clickSwitchModeButton('provider');
    await progressNotePage.expectLoaded();
  }

  async function enterProcedureInfo(
    procedureInfo: ProcedureInfo,
    documentProcedurePage: DocumentProcedurePage
  ): Promise<void> {
    await documentProcedurePage.setConsentForProcedureChecked(procedureInfo.consentChecked);
    await documentProcedurePage.selectProcedureType(procedureInfo.procedureType);
    await documentProcedurePage.selectCptCode(procedureInfo.cptCode);
    await documentProcedurePage.selectDiagnosis(procedureInfo.diagnosisCode);
    await documentProcedurePage.selectPerformedBy(procedureInfo.performedBy);
    await documentProcedurePage.selectAnaesthesia(procedureInfo.anaesthesia);
    await documentProcedurePage.selectSite(procedureInfo.bodySite);
    await documentProcedurePage.selectSideOfBody(procedureInfo.bodySide);
    await documentProcedurePage.selectTechnique(procedureInfo.technique);
    await documentProcedurePage.selectInstruments(procedureInfo.instruments);
    await documentProcedurePage.enterProcedureDetails(procedureInfo.details);
    await documentProcedurePage.selectSpecimenSent(procedureInfo.specimentSent);
    await documentProcedurePage.selectComplications(procedureInfo.complication);
    await documentProcedurePage.selectPatientResponse(procedureInfo.patinentResponse);
    await documentProcedurePage.selectPostProcedureInstructions(procedureInfo.instructions);
    await documentProcedurePage.selectTimeSpent(procedureInfo.timeSpent);
    await documentProcedurePage.selectDocumentedBy(procedureInfo.documentedBy);
  }

  async function verifyProcedureInfo(
    procedureInfo: ProcedureInfo,
    documentProcedurePage: DocumentProcedurePage
  ): Promise<void> {
    await documentProcedurePage.verifyConsentForProcedureChecked(procedureInfo.consentChecked);
    await documentProcedurePage.verifyProcedureType(procedureInfo.procedureType);
    await documentProcedurePage.verifyCptCode(procedureInfo.cptCode + ' ' + procedureInfo.cptName);
    await documentProcedurePage.verifyDiagnosis(procedureInfo.diagnosisName + ' ' + procedureInfo.diagnosisCode);
    await documentProcedurePage.verifyPerformedBy(procedureInfo.performedBy);
    await documentProcedurePage.verifyAnaesthesia(procedureInfo.anaesthesia);
    await documentProcedurePage.verifySite(procedureInfo.bodySite);
    await documentProcedurePage.verifySideOfBody(procedureInfo.bodySide);
    await documentProcedurePage.verifyTechnique(procedureInfo.technique);
    await documentProcedurePage.verifyInstruments(procedureInfo.instruments);
    await documentProcedurePage.verifyProcedureDetails(procedureInfo.details);
    await documentProcedurePage.verifySpecimenSent(procedureInfo.specimentSent);
    await documentProcedurePage.verifyComplications(procedureInfo.complication);
    await documentProcedurePage.verifyPatientResponse(procedureInfo.patinentResponse);
    await documentProcedurePage.verifyPostProcedureInstructions(procedureInfo.instructions);
    await documentProcedurePage.verifyTimeSpent(procedureInfo.timeSpent);
    await documentProcedurePage.verifyDocumentedBy(procedureInfo.documentedBy);
  }

  async function verifyProcedureRow(procedureInfo: ProcedureInfo, procedureRow: ProcedureRow): Promise<void> {
    await procedureRow.verifyProcedureCptCode(procedureInfo.cptCode + '-' + procedureInfo.cptName);
    await procedureRow.verifyProcedureType(procedureInfo.procedureType);
    await procedureRow.verifyProcedureDiagnosis(procedureInfo.diagnosisCode + '-' + procedureInfo.diagnosisName);
    await procedureRow.verifyProcedureDocumentedBy(procedureInfo.documentedBy);
  }

  function progressNoteProcedureDetails(procedureInfo: ProcedureInfo): string[] {
    return [
      'CPT: ' + procedureInfo.cptCode + ' ' + procedureInfo.cptName,
      'Dx: ' + procedureInfo.diagnosisCode + ' ' + procedureInfo.diagnosisName,
      'Performed by: ' + procedureInfo.performedBy,
      'Anaesthesia / medication used: ' + procedureInfo.anaesthesia,
      'Site/location: ' + procedureInfo.bodySite,
      'Side of body: ' + procedureInfo.bodySide,
      'Technique: ' + procedureInfo.technique,
      'Instruments / supplies used: ' + procedureInfo.instruments,
      'Procedure details: ' + procedureInfo.details,
      'Specimen sent: ' + procedureInfo.specimentSent,
      'Complications: ' + procedureInfo.complication,
      'Patient response: ' + procedureInfo.patinentResponse,
      'Post-procedure instructions: ' + procedureInfo.instructions,
      'Time spent: ' + procedureInfo.timeSpent,
      'Documented by: ' + procedureInfo.documentedBy,
    ];
  }
});
