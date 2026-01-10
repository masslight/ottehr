import { BrowserContext, Page, test } from '@playwright/test';
import { ActivityDefinition } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DocumentProcedurePage,
  expectDocumentProcedurePage,
  openDocumentProcedurePage,
} from 'tests/e2e/page/DocumentProcedurePage';
import { FinalResultPage } from 'tests/e2e/page/FinalResultPage';
import { expectAssessmentPage } from 'tests/e2e/page/in-person/InPersonAssessmentPage';
import { openInPersonProgressNotePage } from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { expectNursingOrderCreatePage } from 'tests/e2e/page/NursingOrderCreatePage';
import { expectNursingOrderDetailsPage } from 'tests/e2e/page/NursingOrderDetailsPage';
import { NursingOrdersPage } from 'tests/e2e/page/NursingOrdersPage';
import { expectOrderDetailsPage, OrderInHouseLabPage } from 'tests/e2e/page/OrderInHouseLabPage';
import { expectPatientInfoPage } from 'tests/e2e/page/PatientInfo';
import { PerformTestPage } from 'tests/e2e/page/PerformTestPage';
import { ProcedureRow } from 'tests/e2e/page/ProceduresPage';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';
import { convertActivityDefinitionToTestItem, TestItem } from 'utils';
import inHouseLabActivityDefinitionsJson from '../../../../../../config/oystehr/in-house-lab-activity-definitions.json' assert { type: 'json' };
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
  instruments: string[];
  details: string;
  specimenSent: string;
  complication: string;
  patientResponse: string;
  instructions: string[];
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

const CONFIG_PROCEDURES = PROCEDURE_TYPE_CODINGS.map((procedure) => {
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
});

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
  instruments: [PROCEDURE_SUPPLIES_CODINGS[0].display],
  details: 'test details a',
  specimenSent: 'Yes',
  complication: PROCEDURE_COMPLICATIONS_CODINGS[1].display,
  patientResponse: PROCEDURE_PATIENT_RESPONSES_CODINGS[0].display,
  instructions: [PROCEDURE_POST_INSTRUCTIONS_CODINGS[0].display],
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
  instruments: [PROCEDURE_SUPPLIES_CODINGS[1].display],
  details: 'test details b',
  specimenSent: 'No',
  complication: PROCEDURE_COMPLICATIONS_CODINGS[2].display,
  patientResponse: PROCEDURE_PATIENT_RESPONSES_CODINGS[1].display,
  instructions: [PROCEDURE_POST_INSTRUCTIONS_CODINGS[1].display],
  timeSpent: PROCEDURE_TIME_SPENT_CODINGS[1].display,
  documentedBy: 'Healthcare staff',
};

const resourceHandler = new ResourceHandler(`documentProceduresPage-${DateTime.now().toMillis()}`);

let sideMenu: SideMenu;
let context: BrowserContext;
let page: Page;
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

test.describe.configure({ mode: 'serial' });

test.describe('Procedures Page', () => {
  test('PRC-1 Procedures happy path', async () => {
    await test.step('PRC-1.1 Create a procedure', async () => {
      const documentProcedurePage = await openDocumentProcedurePage(resourceHandler.appointment.id!, page);
      await enterProcedureInfo(PROCEDURE_A, documentProcedurePage);
      const proceduresPage = await documentProcedurePage.clickSaveButton();
      const procedureRow = proceduresPage.getProcedureRow(PROCEDURE_A.procedureType);
      await verifyProcedureRow(PROCEDURE_A, procedureRow);
    });

    await test.step('PRC-1.2 Verify procedure details on progress note', async () => {
      const progressNotePage = await sideMenu.clickReviewAndSign();
      await progressNotePage.verifyProcedure(PROCEDURE_A.procedureType, progressNoteProcedureDetails(PROCEDURE_A));
    });

    await test.step('PRC-1.3 Verify procedure details on procedure details page', async () => {
      const proceduresPage = await sideMenu.clickProcedures();
      const documentProcedurePage = await proceduresPage.getProcedureRow(PROCEDURE_A.procedureType).click();
      await verifyProcedureInfo(PROCEDURE_A, documentProcedurePage);
    });

    await test.step('PRC-1.4 Edit the procedure', async () => {
      const documentProcedurePage = await expectDocumentProcedurePage(page);
      await enterProcedureInfo(PROCEDURE_B, documentProcedurePage);
      await documentProcedurePage.deleteDiagnosis(PROCEDURE_A.diagnosisName + ' ' + PROCEDURE_A.diagnosisCode);
      const proceduresPage = await documentProcedurePage.clickSaveButton();
      const procedureRow = proceduresPage.getProcedureRow(PROCEDURE_B.procedureType);
      await verifyProcedureRow(PROCEDURE_B, procedureRow);
    });

    await test.step('PRC-1.5 Verify edited procedure details on progress note', async () => {
      const progressNotePage = await sideMenu.clickReviewAndSign();
      await progressNotePage.verifyProcedure(PROCEDURE_B.procedureType, progressNoteProcedureDetails(PROCEDURE_B));
    });

    await test.step('PRC-1.6 Verify edited procedure details on procedure details page', async () => {
      const proceduresPage = await sideMenu.clickProcedures();
      const procedureRow = proceduresPage.getProcedureRow(PROCEDURE_B.procedureType);
      const documentProcedurePage = await procedureRow.click();
      await verifyProcedureInfo(PROCEDURE_B, documentProcedurePage);
    });
  });
});

test.describe('In-house labs page', async () => {
  const DIAGNOSIS = 'Situs inversus';
  const SOURCE = 'Nasopharyngeal swab';
  const TEST_RESULT_DETECTED = 'Detected';
  const SECTION_TITLE = 'In-House Labs';
  const STATUS = {
    ORDERED: 'ORDERED',
    COLLECTED: 'COLLECTED',
    FINAL: 'FINAL',
  };

  const TEST_TYPE_TO_CPT: Record<string, string> = {};
  const radioEntryTestItems: TestItem[] = [];
  const selectAndNumericTestItems: TestItem[] = [];

  Object.values(inHouseLabActivityDefinitionsJson.fhirResources).forEach((resource) => {
    const fhirActivityDefinition = resource.resource as ActivityDefinition;
    const testItem = convertActivityDefinitionToTestItem(fhirActivityDefinition);

    if (testItem.components.radioComponents.length > 0 && testItem.components.groupedComponents.length === 0) {
      radioEntryTestItems.push(testItem);
    } else if (testItem.components.radioComponents.length === 0 && testItem.components.groupedComponents.length > 0) {
      selectAndNumericTestItems.push(testItem);
    }

    const coding = resource.resource.code.coding;
    const name = coding.find(
      (coding) => coding.system === 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-test-code'
    )?.code;
    const cptCode = coding.find((coding) => coding.system === 'http://www.ama-assn.org/go/cpt')?.code;
    if (name && cptCode) {
      TEST_TYPE_TO_CPT[name] = cptCode;
    }
  });

  test('IHL-1 In-house labs. Happy Path', async () => {
    let TEST_NAME: string;
    await test.step('IHL-1.1 Open In-house Labs and place order', async () => {
      const orderInHouseLabPage = await prepareAndOpenInHouseLabsPage(page);
      await orderInHouseLabPage.verifyOrderAndPrintLabeButtonDisabled();
      await orderInHouseLabPage.verifyOrderInHouseLabButtonDisabled();
      TEST_NAME = await orderInHouseLabPage.selectRadioEntryInHouseLab(radioEntryTestItems);
      const CPT_CODE = TEST_TYPE_TO_CPT[TEST_NAME];
      await orderInHouseLabPage.verifyCPTCode(CPT_CODE);
      await orderInHouseLabPage.verifyOrderInHouseLabButtonEnabled();
      await orderInHouseLabPage.verifyOrderAndPrintLabelButtonEnabled();
      await orderInHouseLabPage.clickOrderInHouseLabButton();
    });

    await test.step('IHL-1.2 Collect sample', async () => {
      const orderDetailsPage = await expectOrderDetailsPage(page);
      await orderDetailsPage.collectSamplePage.verifyTestName(TEST_NAME);
      await orderDetailsPage.collectSamplePage.verifyMarkAsCollectedButtonDisabled();
      await orderDetailsPage.collectSamplePage.verifyStatus(STATUS.ORDERED);
      await orderDetailsPage.collectSamplePage.fillSource(SOURCE);
      await orderDetailsPage.collectSamplePage.clickMarkAsCollected();
    });

    await test.step('IHL-1.3 Perform test and submit result', async () => {
      const performTestPage = new PerformTestPage(page);
      await performTestPage.verifyPerformTestPageOpened();
      await performTestPage.verifyStatus(STATUS.COLLECTED);
      await performTestPage.verifySubmitButtonDisabled();
      await performTestPage.selectTestResult(TEST_RESULT_DETECTED);
      await performTestPage.verifySubmitButtonEnabled();
      await performTestPage.submitOrderResult();
    });

    await test.step('IHL-1.4 Verify final result & PDF', async () => {
      const finalResultPage = new FinalResultPage(page);
      await finalResultPage.verifyStatus(STATUS.FINAL);
      await finalResultPage.verifyTestResult(TEST_RESULT_DETECTED);
      await finalResultPage.verifyResultsPDFButtonEnabled();
      await finalResultPage.verifyResultsPdfOpensInNewTab();
    });

    await test.step('IHL-1.5 Verify Progress Note shows IHL entry', async () => {
      const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
      await progressNotePage.verifyInHouseLabs(SECTION_TITLE, TEST_NAME);
    });
  });

  async function prepareAndOpenInHouseLabsPage(page: Page): Promise<OrderInHouseLabPage> {
    await sideMenu.clickAssessment();
    const assessmentPage = await expectAssessmentPage(page);
    await assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS });
    const inHouseLabsPage = await sideMenu.clickInHouseLabs();
    return await inHouseLabsPage.clickOrderButton();
  }
});

test.describe('Nursing Orders Page', () => {
  interface NursingOrderInfo {
    notes: string;
    status: string;
  }

  const NURSING_ORDER_A: NursingOrderInfo = {
    notes: 'Administer medication as prescribed, monitor vital signs every 2 hours',
    status: 'PENDING',
  };

  const NURSING_ORDER_B: NursingOrderInfo = {
    notes: 'Patient requires wound care and dressing change twice daily',
    status: 'PENDING',
  };

  test('NRS-1 Nursing Orders happy path', async () => {
    await test.step('Create a nursing order', async () => {
      const nursingOrdersPage = await sideMenu.clickNursingOrders();
      const createOrderPage = await nursingOrdersPage.clickOrderButton();

      await createOrderPage.enterOrderNote(NURSING_ORDER_A.notes);
      await createOrderPage.verifyOrderButtonDisabled(false);

      const ordersPage = await createOrderPage.clickOrderButton();
      const orderRow = await ordersPage.getFirstOrderRow();

      await orderRow.verifyOrderNote(NURSING_ORDER_A.notes);
      await orderRow.verifyStatus(NURSING_ORDER_A.status);
    });

    await test.step('NRS-1.1 View nursing order details page', async () => {
      const nursingOrdersPage = await sideMenu.clickNursingOrders();
      const orderRow = await nursingOrdersPage.getFirstOrderRow();
      const detailsPage = await orderRow.click();

      await detailsPage.verifyOrderNote(NURSING_ORDER_A.notes);
      await detailsPage.verifyStatus(NURSING_ORDER_A.status);
      await detailsPage.verifyHistoryVisible();
    });

    await test.step('NRS-1.2 Complete the nursing order', async () => {
      const detailsPage = await expectNursingOrderDetailsPage(page);
      await detailsPage.verifyCompleteOrderButtonEnabled();
      await detailsPage.clickCompleteOrderButton();

      const nursingOrdersPage = new NursingOrdersPage(page);
      const orderRow = await nursingOrdersPage.getOrderRowByNote(NURSING_ORDER_A.notes);
      await orderRow.verifyStatus('COMPLETED');
    });

    await test.step('NRS-1.3 Create second nursing order', async () => {
      const nursingOrdersPage = await sideMenu.clickNursingOrders();
      const createOrderPage = await nursingOrdersPage.clickOrderButton();

      await createOrderPage.enterOrderNote(NURSING_ORDER_B.notes);
      const ordersPage = await createOrderPage.clickOrderButton();

      const orderRow = await ordersPage.getOrderRowByNote(NURSING_ORDER_B.notes);
      await orderRow.verifyOrderNote(NURSING_ORDER_B.notes);
      await orderRow.verifyStatus(NURSING_ORDER_B.status);
    });

    await test.step('NRS-1.4 Delete nursing order', async () => {
      const nursingOrdersPage = await sideMenu.clickNursingOrders();
      const orderRow = await nursingOrdersPage.getOrderRowByNote(NURSING_ORDER_B.notes);
      await orderRow.clickDeleteButton();
      await orderRow.verifyStatus('CANCELLED');
    });
  });

  test('NRS-2 Nursing Order validation', async () => {
    await test.step('NRS-2.1 Verify empty order cannot be submitted', async () => {
      const nursingOrdersPage = await sideMenu.clickNursingOrders();
      const createOrderPage = await nursingOrdersPage.clickOrderButton();

      await createOrderPage.verifyOrderButtonDisabled(true);
      await createOrderPage.enterOrderNote('Test');
      await createOrderPage.verifyOrderButtonDisabled(false);
      await createOrderPage.clearOrderNote();
      await createOrderPage.verifyOrderButtonDisabled(true);
    });

    await test.step('NRS-2.2 Verify max length validation', async () => {
      const createOrderPage = await expectNursingOrderCreatePage(page);
      const longNote = 'a'.repeat(151);
      await createOrderPage.enterOrderNote(longNote);
      await createOrderPage.verifyOrderNoteLength(150);
    });

    await test.step('NRS-2.2 Cancel order creation', async () => {
      const createOrderPage = await expectNursingOrderCreatePage(page);
      await createOrderPage.enterOrderNote('This should be cancelled');
      await createOrderPage.clickCancelButton();

      const nursingOrdersPage = new NursingOrdersPage(page);
      await nursingOrdersPage.verifyOrderNotExists('This should be cancelled');
    });
  });
});

// Procedures helpers
async function setupPractitioners(page: Page): Promise<void> {
  const inPersonHeader = new InPersonHeader(page);
  await page.goto(`in-person/${resourceHandler.appointment.id}/progress-note`);
  await inPersonHeader.verifyStatus('pending');
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  await expectPatientInfoPage(page);
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
