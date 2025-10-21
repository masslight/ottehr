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
import procedureBodySides from '../../../../../../config/oystehr/procedure-body-sides.json' assert { type: 'json' };
import procedureBodySites from '../../../../../../config/oystehr/procedure-body-sites.json' assert { type: 'json' };
import procedureComplications from '../../../../../../config/oystehr/procedure-complications.json' assert { type: 'json' };
import procedureMedicationsUsed from '../../../../../../config/oystehr/procedure-medications-used.json' assert { type: 'json' };
import procedurePatientResponses from '../../../../../../config/oystehr/procedure-patient-responses.json' assert { type: 'json' };
import procedurePostInstructions from '../../../../../../config/oystehr/procedure-post-instructions.json' assert { type: 'json' };
import procedureSupplies from '../../../../../../config/oystehr/procedure-supplies.json' assert { type: 'json' };
import procedureTechniques from '../../../../../../config/oystehr/procedure-techniques.json' assert { type: 'json' };
import procedureTimeSpent from '../../../../../../config/oystehr/procedure-time-spent.json' assert { type: 'json' };
import procedureType from '../../../../../../config/oystehr/procedure-type.json' assert { type: 'json' };

interface ProcedureInfo {
  consentChecked: boolean;
  procedureType: string;
  procedureTypeCptCode?: string;
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
  specimenSent: string;
  complication: string;
  patientResponse: string;
  instructions: string;
  timeSpent: string;
  documentedBy: string;
}

const PROCEDURE_TYPE_CODINGS = procedureType.fhirResources['value-set-procedure-type'].resource.expansion.contains;
const PROCEDURE_MEDICATIONS_USED_CODINGS =
  procedureMedicationsUsed.fhirResources['value-set-procedure-medications-used'].resource.expansion.contains;
const PROCEDURE_BODY_SITES_CODINGS =
  procedureBodySites.fhirResources['value-set-procedure-body-sites'].resource.expansion.contains;
const PROCEDURE_BODY_SIDES_CODINGS =
  procedureBodySides.fhirResources['value-set-procedure-body-sides'].resource.expansion.contains;
const PROCEDURE_TECHNIQUES_CODINGS =
  procedureTechniques.fhirResources['value-set-procedure-techniques'].resource.expansion.contains;
const PROCEDURE_SUPPLIES_CODINGS =
  procedureSupplies.fhirResources['value-set-procedure-supplies'].resource.expansion.contains;
const PROCEDURE_COMPLICATIONS_CODINGS =
  procedureComplications.fhirResources['value-set-procedure-complications'].resource.expansion.contains;
const PROCEDURE_PATIENT_RESPONSES_CODINGS =
  procedurePatientResponses.fhirResources['value-set-procedure-patient-responses'].resource.expansion.contains;
const PROCEDURE_POST_INSTRUCTIONS_CODINGS =
  procedurePostInstructions.fhirResources['value-set-procedure-post-instructions'].resource.expansion.contains;
const PROCEDURE_TIME_SPENT_CODINGS =
  procedureTimeSpent.fhirResources['value-set-procedure-time-spent'].resource.expansion.contains;

const CONFIG_PROCEDURES = PROCEDURE_TYPE_CODINGS.map(
  (procedure) => {
    const dropDownChoice = procedure.display;
    const codeableConcept = procedure.extension?.[0].valueCodeableConcept.coding[0];
    if (!codeableConcept) {
      return {
        dropDownChoice,
      };
    }
    return {
      dropDownChoice,
      display: codeableConcept.code + ' ' + codeableConcept.display,
    };
  }
);

const PROCEDURE_A: ProcedureInfo = {
  consentChecked: true,
  procedureType: CONFIG_PROCEDURES[0].dropDownChoice,
  procedureTypeCptCode: CONFIG_PROCEDURES[0].display,
  cptCode: '73000',
  cptName: 'X-ray of collar bone',
  diagnosisCode: 'D51.0',
  diagnosisName: 'Vitamin B12 deficiency anemia due to intrinsic factor deficiency',
  performedBy: 'Healthcare staff',
  anaesthesia: PROCEDURE_MEDICATIONS_USED_CODINGS[0].display,
  bodySite: PROCEDURE_BODY_SITES_CODINGS[0].display,
  bodySide: PROCEDURE_BODY_SIDES_CODINGS[0].display,
  technique: PROCEDURE_TECHNIQUES_CODINGS[0].display,
  instruments: PROCEDURE_SUPPLIES_CODINGS[0].display,
  details: 'test details a',
  specimenSent: 'Yes',
  complication: PROCEDURE_COMPLICATIONS_CODINGS[1].display,
  patinentResponse: PROCEDURE_PATIENT_RESPONSES_CODINGS[0].display,
  instructions: PROCEDURE_POST_INSTRUCTIONS_CODINGS[0].display,
  timeSpent: PROCEDURE_TIME_SPENT_CODINGS[0].display,
  documentedBy: 'Provider',
};

const PROCEDURE_B: ProcedureInfo = {
  consentChecked: false,
  procedureType: CONFIG_PROCEDURES[1].dropDownChoice,
  procedureTypeCptCode: CONFIG_PROCEDURES[1].display,
  cptCode: '11900',
  cptName: 'Injection into skin growth, 1-7 growths',
  diagnosisCode: 'R50.9',
  diagnosisName: 'Fever, unspecified',
  performedBy: 'Both',
  anaesthesia: PROCEDURE_MEDICATIONS_USED_CODINGS[1].display,
  bodySite: PROCEDURE_BODY_SITES_CODINGS[1].display,
  bodySide: PROCEDURE_BODY_SIDES_CODINGS[1].display,
  technique: PROCEDURE_TECHNIQUES_CODINGS[1].display,
  instruments: PROCEDURE_SUPPLIES_CODINGS[1].display,
  details: 'test details b',
  specimenSent: 'No',
  complication: PROCEDURE_COMPLICATIONS_CODINGS[2].display,
  patinentResponse: PROCEDURE_PATIENT_RESPONSES_CODINGS[1].display,
  instructions: PROCEDURE_POST_INSTRUCTIONS_CODINGS[1].display,
  timeSpent: PROCEDURE_TIME_SPENT_CODINGS[1].display,
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

    await test.step('Verify procedure details on progress note', async () => {
      const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
      await progressNotePage.verifyProcedure(PROCEDURE_A.procedureType, progressNoteProcedureDetails(PROCEDURE_A));
    });

    await test.step('Verify procedure details on procedure details page', async () => {
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

    await test.step('Verify edited procedure details on progress note', async () => {
      const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
      await progressNotePage.verifyProcedure(PROCEDURE_B.procedureType, progressNoteProcedureDetails(PROCEDURE_B));
    });

    await test.step('Verify edited procedure details on procedure details page', async () => {
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
    await documentProcedurePage.selectSpecimenSent(procedureInfo.specimenSent);
    await documentProcedurePage.selectComplications(procedureInfo.complication);
    await documentProcedurePage.selectPatientResponse(procedureInfo.patientResponse);
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
    await documentProcedurePage.verifySpecimenSent(procedureInfo.specimenSent);
    await documentProcedurePage.verifyComplications(procedureInfo.complication);
    await documentProcedurePage.verifyPatientResponse(procedureInfo.patientResponse);
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
    const cptPrefix = procedureInfo.procedureTypeCptCode ? procedureInfo.procedureTypeCptCode + ':' : '';
    return [
      // colon will be used to split and reorder string so this line is different
      'CPT:' + cptPrefix + procedureInfo.cptCode + ' ' + procedureInfo.cptName,
      'Dx: ' + procedureInfo.diagnosisCode + ' ' + procedureInfo.diagnosisName,
      'Performed by: ' + procedureInfo.performedBy,
      'Anaesthesia / medication used: ' + procedureInfo.anaesthesia,
      'Site/location: ' + procedureInfo.bodySite,
      'Side of body: ' + procedureInfo.bodySide,
      'Technique: ' + procedureInfo.technique,
      'Instruments / supplies used: ' + procedureInfo.instruments,
      'Procedure details: ' + procedureInfo.details,
      'Specimen sent: ' + procedureInfo.specimenSent,
      'Complications: ' + procedureInfo.complication,
      'Patient response: ' + procedureInfo.patientResponse,
      'Post-procedure instructions: ' + procedureInfo.instructions,
      'Time spent: ' + procedureInfo.timeSpent,
      'Documented by: ' + procedureInfo.documentedBy,
    ];
  }
});
