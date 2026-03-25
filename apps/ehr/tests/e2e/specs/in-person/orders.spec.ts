import { BatchInputPostRequest } from '@oystehr/sdk';
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { ActivityDefinition, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DocumentProcedurePage,
  expectDocumentProcedurePage,
  openDocumentProcedurePage,
} from 'tests/e2e/page/DocumentProcedurePage';
import { expectAssessmentPage } from 'tests/e2e/page/in-person/InPersonAssessmentPage';
import { openInPersonProgressNotePage } from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import {
  FinalResultPage,
  InHouseLabsPage,
  MockReflexTestConfig,
  OrderInHouseLabPage,
  PerformTestPage,
  RadioSelectionResult,
} from 'tests/e2e/page/lab';
import inHouseLabsMockData from 'tests/e2e/page/lab/in-house/mock-data.json' assert { type: 'json' };
import { expectNursingOrderCreatePage } from 'tests/e2e/page/NursingOrderCreatePage';
import { expectNursingOrderDetailsPage } from 'tests/e2e/page/NursingOrderDetailsPage';
import { NursingOrdersPage } from 'tests/e2e/page/NursingOrdersPage';
import { ProcedureRow } from 'tests/e2e/page/ProceduresPage';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';
import {
  checkActivityDefinitionForReflexLogic,
  convertActivityDefinitionToDataEntryTestItem,
  CPTCodeDTO,
  DataEntryTestItem,
  makeCptCodeDisplay,
  REPEAT_TEST_CPT_CODE_MODIFIER,
  unbundleBatchPostOutput,
} from 'utils';
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
  technique: string[];
  instruments: string[];
  details: string;
  specimenSent: string;
  complication: string;
  patientResponse: string;
  instructions: string[];
  timeSpent: string;
  documentedBy: string;
}
const PROCEDURE_TYPE_CODINGS = Object.entries(procedureType.fhirResources).find(([key]) =>
  key.startsWith('value-set-procedure-type')
)?.[1].resource.expansion.contains;
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

const CONFIG_PROCEDURES = PROCEDURE_TYPE_CODINGS!.map((procedure) => {
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
  technique: [PROCEDURE_TECHNIQUES_CODINGS[0].display],
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
  technique: [PROCEDURE_TECHNIQUES_CODINGS[1].display],
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
  test('Procedures happy path', async () => {
    await test.step('Create a procedure', async () => {
      const documentProcedurePage = await openDocumentProcedurePage(resourceHandler.appointment.id!, page);
      await enterProcedureInfo(PROCEDURE_A, documentProcedurePage);
      const proceduresPage = await documentProcedurePage.clickSaveButton();
      const procedureRow = proceduresPage.getProcedureRow(PROCEDURE_A.procedureType);
      await verifyProcedureRow(PROCEDURE_A, procedureRow);
    });

    await test.step('Verify procedure details on progress note', async () => {
      const progressNotePage = await sideMenu.clickReviewAndSign();
      await progressNotePage.verifyProcedure(PROCEDURE_A.procedureType, progressNoteProcedureDetails(PROCEDURE_A));
    });

    await test.step('Verify procedure details on procedure details page', async () => {
      const proceduresPage = await sideMenu.clickProcedures();
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
      const progressNotePage = await sideMenu.clickReviewAndSign();
      await progressNotePage.verifyProcedure(PROCEDURE_B.procedureType, progressNoteProcedureDetails(PROCEDURE_B));
    });

    await test.step('Verify edited procedure details on procedure details page', async () => {
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
  const SECTION_TITLE = 'In-House Labs';
  const STATUS = {
    ORDERED: 'ORDERED',
    COLLECTED: 'COLLECTED',
    FINAL: 'FINAL',
  };

  const TEST_TYPE_TO_CPT: Record<string, string> = {};
  const radioEntryTestItems: DataEntryTestItem[] = [];
  const repeatableRadioEntryTestItems: DataEntryTestItem[] = [];
  const selectAndNumericTestItems: DataEntryTestItem[] = [];
  let mockResourceIds: string[] = [];
  let reflexTest: MockReflexTestConfig;

  test.beforeAll('Handling ActivityDefinition and List resources for in-house labs tests', async () => {
    const adRequests: BatchInputPostRequest<ActivityDefinition>[] = [];

    // standard + repeatable tests
    inHouseLabsMockData.activityDefinitions.forEach((ad) => {
      const fhirActivityDefinition = ad as ActivityDefinition;
      const testItem = convertActivityDefinitionToDataEntryTestItem(fhirActivityDefinition);

      if (testItem.components.type === 'radio') {
        radioEntryTestItems.push(testItem);
        if (testItem.repeatable) {
          repeatableRadioEntryTestItems.push(testItem);
        }
      } else if (testItem.components.type === 'grouped') {
        selectAndNumericTestItems.push(testItem);
      }

      const coding = fhirActivityDefinition.code?.coding ?? [];
      const name = coding.find((c) => c.system === 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-test-code')
        ?.code;
      const cptCode = coding.find((c) => c.system === 'http://www.ama-assn.org/go/cpt')?.code;
      if (name && cptCode) {
        TEST_TYPE_TO_CPT[name] = cptCode;
      }

      const { fullUrl, ...resource } = ad;
      adRequests.push({
        method: 'POST' as const,
        url: 'ActivityDefinition',
        fullUrl: fullUrl as string,
        resource: resource as ActivityDefinition,
      });
    });

    // reflex test
    const { parentTest, childTest } = inHouseLabsMockData.reflexTest;

    const parentTestItem = convertActivityDefinitionToDataEntryTestItem(
      parentTest.activityDefinition as ActivityDefinition
    );
    const parentReflexLogic = checkActivityDefinitionForReflexLogic(
      parentTest.activityDefinition as ActivityDefinition
    );
    const parentAlert = parentReflexLogic?.reflexAlertExt.valueString || 'alert is missing in mock data!?';

    const childTestItem = convertActivityDefinitionToDataEntryTestItem(
      childTest.activityDefinition as ActivityDefinition
    );

    reflexTest = {
      parent: { test: parentTestItem, alert: parentAlert, results: parentTest.results },
      child: { test: childTestItem, results: childTest.results },
    };

    [parentTest.activityDefinition, childTest.activityDefinition].forEach((ad) => {
      const coding = ad.code?.coding ?? [];
      const name = coding.find((c) => c.system === 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-test-code')
        ?.code;
      const cptCode = coding.find((c) => c.system === 'http://www.ama-assn.org/go/cpt')?.code;
      if (name && cptCode) {
        TEST_TYPE_TO_CPT[name] = cptCode;
      }

      const { fullUrl, ...resource } = ad;
      adRequests.push({
        method: 'POST' as const,
        url: 'ActivityDefinition',
        fullUrl: fullUrl as string,
        resource: resource as ActivityDefinition,
      });
    });

    // lab set
    const listRequests = inHouseLabsMockData.lists.map((list) => {
      return {
        method: 'POST' as const,
        url: 'List',
        resource: list as List,
      };
    });

    // load all necessary resources into project
    const oystehr = await resourceHandler.apiClient;
    const createdBundle = await oystehr.fhir.transaction<ActivityDefinition | List>({
      requests: [...adRequests, ...listRequests],
    });
    const resources = unbundleBatchPostOutput<ActivityDefinition | List>(createdBundle);

    mockResourceIds = resources.map((r) => `${r.resourceType}/${r.id}`);
  });

  test.afterAll('Deleting all ActivityDefinition and List resources used in in-house lab tests', async () => {
    if (mockResourceIds.length) {
      const oystehr = await resourceHandler.apiClient;
      await oystehr.fhir.batch({
        requests: mockResourceIds.map((ref) => ({
          method: 'DELETE' as const,
          url: ref,
        })),
      });
    }
  });

  test('In-house labs. Tests Various Functionality.', async () => {
    let testName: string = 'placeholder';
    let testDetails: RadioSelectionResult;

    await test.step('IHL-1 Happy path - radio entry test', async () => {
      await test.step('IHL-1.1 Open In-house Labs and place order', async () => {
        const orderInHouseLabPage = await prepareAndOpenInHouseLabsPage(page);
        await orderInHouseLabPage.verifyOrderAndPrintLabelButtonDisabled();
        await orderInHouseLabPage.verifyOrderInHouseLabButtonDisabled();
        testName = radioEntryTestItems[0].name;
        await orderInHouseLabPage.selectTest(testName);
        const CPT_CODE = TEST_TYPE_TO_CPT[testName];
        await orderInHouseLabPage.verifyCPTCode(CPT_CODE, testName);
        await orderInHouseLabPage.verifyOrderInHouseLabButtonEnabled();
        await orderInHouseLabPage.verifyOrderAndPrintLabelButtonEnabled();
        await orderInHouseLabPage.clickOrderInHouseLabButton();
      });

      await test.step('IHL-1.2 Collect sample', async () => {
        const orderDetailsPage = await OrderInHouseLabPage.detailsPageIsOpen(page);
        await orderDetailsPage.collectSamplePage.verifyTestName(testName);
        await orderDetailsPage.collectSamplePage.verifyStatus(STATUS.ORDERED);
        await orderDetailsPage.collectSamplePage.fillSource(SOURCE);
        await orderDetailsPage.collectSamplePage.clickMarkAsCollected();
      });

      await test.step('IHL-1.3 Perform test and submit result', async () => {
        const performTestPage = await PerformTestPage.isOpen(page);
        await performTestPage.verifyStatus(STATUS.COLLECTED);
        await performTestPage.verifySubmitButtonDisabled();
        testDetails = await performTestPage.selectRadioTestResult(testName);
        await performTestPage.verifySubmitButtonEnabled();
        await performTestPage.submitOrderResult();
      });

      await test.step('IHL-1.4 Verify final result & PDF & ability to edit results', async () => {
        const finalResultPage = new FinalResultPage(page);
        await finalResultPage.verifyStatus(STATUS.FINAL);
        await finalResultPage.verifyTestResult(testDetails.selectedValue.testId);
        await finalResultPage.verifyResultsPDFButtonEnabled();
        await finalResultPage.verifyResultsPdfOpensInNewTab();

        await test.step('verify edit in-house results functionality', async () => {
          await finalResultPage.verifyEditResultFunctionality(testDetails);
        });
      });

      await test.step('IHL-1.5 Verify Progress Note shows IHL entry', async () => {
        const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
        await progressNotePage.verifyInHouseLabs(SECTION_TITLE, testDetails.testName);
      });
    });

    await test.step('IHL-2 Verify delete in-house lab functionality at each status', async () => {
      // go back to the labs table
      let inHouseLabsPage = await sideMenu.clickInHouseLabs();

      await test.step('IHL-2.1 Delete a FINAL lab', async () => {
        // lab that we created and entered results for from above
        await inHouseLabsPage.deleteTest(testDetails.testServiceRequestId);
      });

      await test.step('IHL-2.2 Delete a COLLECTED lab', async () => {
        let collectedLabServiceRequestId: string = 'placeholder';
        await test.step('IHL-2.2.1 Create a lab', async () => {
          const orderInHouseLabPage = await inHouseLabsPage.clickOrderButton();
          testName = radioEntryTestItems[0].name;
          await orderInHouseLabPage.selectTest(testName);
          await orderInHouseLabPage.clickOrderInHouseLabButton();
        });

        await test.step('IHL-2.2.2 Mark as collected', async () => {
          const orderDetailsPage = await OrderInHouseLabPage.detailsPageIsOpen(page);
          await orderDetailsPage.collectSamplePage.fillSource(SOURCE);
          await orderDetailsPage.collectSamplePage.clickMarkAsCollected();
          collectedLabServiceRequestId = orderDetailsPage.getServiceRequestId();
        });

        await test.step('IHL-2.2.3 Delete the lab', async () => {
          // go back to the labs table
          inHouseLabsPage = await sideMenu.clickInHouseLabs();
          await inHouseLabsPage.deleteTest(collectedLabServiceRequestId);
        });
      });

      await test.step('IHL-2.3 Delete an ORDERED lab', async () => {
        let orderedLabServiceRequestId: string = 'placeholder';
        await test.step('IHL-2.3.1 Create a lab', async () => {
          const orderInHouseLabPage = await inHouseLabsPage.clickOrderButton();
          testName = radioEntryTestItems[0].name;
          await orderInHouseLabPage.selectTest(testName);
          await orderInHouseLabPage.clickOrderInHouseLabButton();

          // get the service request id
          const orderedLabOrderPage = await OrderInHouseLabPage.detailsPageIsOpen(page);
          orderedLabServiceRequestId = orderedLabOrderPage.getServiceRequestId();
        });

        await test.step('IHL-2.3.2 Delete the lab', async () => {
          // go back to the labs table
          inHouseLabsPage = await sideMenu.clickInHouseLabs();
          await inHouseLabsPage.deleteTest(orderedLabServiceRequestId);
        });
      });
    });

    await test.step('IHL-3 Add inhouse labs via lab sets', async () => {
      // go back to the labs table
      let inHouseLabsPage = await sideMenu.clickInHouseLabs();

      const orderInHouseLabPage = await inHouseLabsPage.clickOrderButton();
      await orderInHouseLabPage.selectALabSet();
      await orderInHouseLabPage.clickOrderInHouseLabButton();

      // confirm we've been nav'd to the orders table
      inHouseLabsPage = await InHouseLabsPage.isOpen(page);

      // make sure tests were created
      const testsFound = await inHouseLabsPage.countTableRows();
      expect(testsFound, `${testsFound} tests were created`).toBeGreaterThan(0);
    });

    // todo labs add step about checking breadcrumbs
    await test.step('IHL-4 Repeat test happy path', async () => {
      await test.step('IHL-4.1 Order a repeatable test', async () => {
        await test.step('IHL-4.1.1 Create and submit order', async () => {
          // make sure you are on the orders table page
          const inHouseLabsPage = await InHouseLabsPage.isOpen(page);

          // order a repeatable radio entry test
          const orderInHouseLabPage = await inHouseLabsPage.clickOrderButton();
          testName = repeatableRadioEntryTestItems[0].name;
          await orderInHouseLabPage.selectTest(testName);

          // try to order as repeat (it should error)
          await orderInHouseLabPage.clickRunAsRepeatForTest(testName);

          // check for error
          await orderInHouseLabPage.clickOrderInHouseLabButton();
          const error = orderInHouseLabPage.error;
          await expect(error).toBeVisible();
          await expect(error).toContainText(
            `You cannot run ${testName} as repeat, no initial tests could be found for this encounter.`
          );

          // uncheck run as repeat and click order again
          await orderInHouseLabPage.clickRunAsRepeatForTest(testName);
          await orderInHouseLabPage.clickOrderInHouseLabButton();
        });

        await test.step('IHL-4.1.2 Enter sample collection info', async () => {
          const orderDetailsPage = await OrderInHouseLabPage.detailsPageIsOpen(page);
          await orderDetailsPage.collectSamplePage.fillSource(SOURCE);
          await orderDetailsPage.collectSamplePage.clickMarkAsCollected();
        });

        await test.step('IHL-4.1.3 Enter results', async () => {
          const performTestPage = await PerformTestPage.isOpen(page);
          testDetails = await performTestPage.selectRadioTestResult(testName);
          await performTestPage.verifySubmitButtonEnabled();
          await performTestPage.submitOrderResult();
        });
      });

      await test.step('IHL-4.2 Order a repeat test', async () => {
        await test.step('IHL-4.2.1 Create and submit order', async () => {
          const finalResultPage = await FinalResultPage.isOpen(page);
          await finalResultPage.clickRepeatButton();
          const orderInHouseLabPage = await OrderInHouseLabPage.createPageIsOpen(page);

          // confirm repeat check box is already checked
          await orderInHouseLabPage.confirmRunAsRepeatForTestIsChecked(testName);

          // confirm cptCode has '-91 (QW)'
          const CPT_CODE = `${TEST_TYPE_TO_CPT[testName]}-${REPEAT_TEST_CPT_CODE_MODIFIER.code} (QW)`;
          await orderInHouseLabPage.verifyCPTCode(CPT_CODE, testName);

          await orderInHouseLabPage.clickOrderInHouseLabButton();
        });

        await test.step('IHL-4.2.2 Enter sample collection info', async () => {
          const orderDetailsPage = await OrderInHouseLabPage.detailsPageIsOpen(page);
          await orderDetailsPage.collectSamplePage.fillSource(SOURCE);
          await orderDetailsPage.collectSamplePage.clickMarkAsCollected();
        });

        await test.step('IHL-4.2.3 Enter results', async () => {
          const performTestPage = await PerformTestPage.isOpen(page);
          testDetails = await performTestPage.selectRadioTestResult(testName);
          await performTestPage.verifySubmitButtonEnabled();
          await performTestPage.submitOrderResult();
        });

        await test.step('IHL-4.2.4 Confirm final results page displays all results', async () => {
          const finalResultPage = await FinalResultPage.isOpen(page);
          const resultCount = await finalResultPage.countResultCardsOnPage();
          expect(
            resultCount,
            `confirming both the original and repeat results are present on the final result page`
          ).toBe(2);
        });
      });

      await test.step('IHL-4.3 Confirm cpt codes appear as expected', async () => {
        const originalTestCptCode: CPTCodeDTO = {
          code: TEST_TYPE_TO_CPT[testName],
          display: testName,
        };
        const repeatTestCptCode: CPTCodeDTO = {
          ...originalTestCptCode,
          modifier: [{ code: REPEAT_TEST_CPT_CODE_MODIFIER.code, display: REPEAT_TEST_CPT_CODE_MODIFIER.display }],
        };

        const originalTestCptCodeDisplay = makeCptCodeDisplay(originalTestCptCode);
        const repeatTestCptCodeDisplay = makeCptCodeDisplay(repeatTestCptCode);

        await test.step('IHL-4.3.1 Check progress note', async () => {
          const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
          await progressNotePage.verifyGivenCptCodeIsShown(originalTestCptCodeDisplay);
          await progressNotePage.verifyGivenCptCodeIsShown(repeatTestCptCodeDisplay);
        });

        await test.step('IHL-4.3.2 Check assessment page', async () => {
          await sideMenu.clickAssessment();
          const assessmentPage = await expectAssessmentPage(page);
          await assessmentPage.verifyExactCptCodeDisplayIsShown(originalTestCptCodeDisplay);
          await assessmentPage.verifyExactCptCodeDisplayIsShown(repeatTestCptCodeDisplay);
        });
      });
    });

    await test.step('IHL-5 Reflex test happy path', async () => {
      const reflexTestName = reflexTest.child.test.name;
      const parentTestName = reflexTest.parent.test.name;

      await test.step('IHL-5.1 Order a parent test', async () => {
        await test.step('IHL-5.1.1 Create and submit order', async () => {
          // make sure you are on the orders table page
          const inHouseLabsPage = await sideMenu.clickInHouseLabs();

          // order the parent
          const orderInHouseLabPage = await inHouseLabsPage.clickOrderButton();
          await orderInHouseLabPage.selectTest(parentTestName);
          await orderInHouseLabPage.clickOrderInHouseLabButton();
        });

        await test.step('IHL-5.1.2 Enter sample collection info', async () => {
          const orderDetailsPage = await OrderInHouseLabPage.detailsPageIsOpen(page);
          await orderDetailsPage.collectSamplePage.clickMarkAsCollected();
        });

        await test.step('IHL-5.1.3 Enter results', async () => {
          const performTestPage = await PerformTestPage.isOpen(page);

          const groupedComponents =
            reflexTest.child.test.components.type === 'grouped' ? reflexTest.child.test.components.components : [];
          const containsGroupedComponents = groupedComponents.length > 0;
          if (!containsGroupedComponents) {
            throw new Error(
              `IHL-5.1.3 ERROR: Parent reflex test has an unexpected result entry type, expecting grouped components`
            );
          }

          // enter results
          for (const c of groupedComponents) {
            const displayType = c.displayType;
            const resultKey = `${c.loincCode}-${c.componentName}`;
            const result = reflexTest.parent.results[resultKey].abnormal;

            if (displayType === 'Numeric') {
              await performTestPage.enterNumericResult(c, result);
            }
          }

          // submit
          await performTestPage.verifySubmitButtonEnabled();
          await performTestPage.submitOrderResult();
        });

        // confirm that banner indicating a reflex is triggered appears on final result page with appropriate text
        await test.step('IHL-5.1.4 Confirm reflex test has been triggered', async () => {
          const finalResultPage = await FinalResultPage.isOpen(page);
          const alertToCheck = reflexTest.parent.alert;
          await finalResultPage.confirmReflexAlert(alertToCheck);

          // confirm order reflex test button is there (with expected text) and click it
          // this should take us back to the create page & and the reflex data should be prefilled
          await finalResultPage.clickOrderReflexTestButton(reflexTestName);
        });
      });

      await test.step('IHL-5.2 Order child test', async () => {
        await test.step('IHL-5.2.1 Confirm create order is correct and submit', async () => {
          const orderInHouseLabPage = await OrderInHouseLabPage.createPageIsOpen(page);

          // confirm cptCode has '-91 (QW)'
          const modifier = reflexTest.child.test.cptCode.flatMap((code) => code.modifier?.map((m) => m.code)).join('-');
          const CPT_CODE = `${TEST_TYPE_TO_CPT[reflexTestName]}-${modifier} (QW)`;
          await orderInHouseLabPage.verifyCPTCode(CPT_CODE, reflexTestName);

          await orderInHouseLabPage.clickOrderInHouseLabButton();
        });

        await test.step('IHL-5.2.2 Enter sample collection info', async () => {
          const orderDetailsPage = await OrderInHouseLabPage.detailsPageIsOpen(page);
          await orderDetailsPage.collectSamplePage.clickMarkAsCollected();
        });

        await test.step('IHL-5.2.3 Enter results', async () => {
          const performTestPage = await PerformTestPage.isOpen(page);

          const groupedComponents =
            reflexTest.child.test.components.type === 'grouped' ? reflexTest.child.test.components.components : [];
          const containsGroupedComponents = groupedComponents.length > 0;
          if (!containsGroupedComponents) {
            throw new Error(
              `IHL-5.2.3 ERROR: Child reflex test has an unexpected result entry type, expecting grouped components`
            );
          }

          // enter results
          for (const c of groupedComponents) {
            const displayType = c.displayType;
            const resultKey = `${c.loincCode}-${c.componentName}`;
            const result = reflexTest.child.results[resultKey].abnormal;

            if (displayType === 'Numeric') {
              await performTestPage.enterNumericResult(c, result);
            }
          }

          // submit
          await performTestPage.verifySubmitButtonEnabled();
          await performTestPage.submitOrderResult();
        });
      });

      // confirm the results page has two results
      await test.step('IHL-5.3 Confirm final results page displays all results', async () => {
        const finalResultPage = await FinalResultPage.isOpen(page);
        const resultCount = await finalResultPage.countResultCardsOnPage();
        expect(resultCount, `confirming both the parent and child results are present on the final result page`).toBe(
          2
        );

        // also confirm the order reflex test button is gone
        await finalResultPage.orderReflexButtonIsHidden();
      });
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

  test('Nursing Orders happy path', async () => {
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

    await test.step('View nursing order details page', async () => {
      const nursingOrdersPage = await sideMenu.clickNursingOrders();
      const orderRow = await nursingOrdersPage.getFirstOrderRow();
      const detailsPage = await orderRow.click();

      await detailsPage.verifyOrderNote(NURSING_ORDER_A.notes);
      await detailsPage.verifyStatus(NURSING_ORDER_A.status);
      await detailsPage.verifyHistoryVisible();
    });

    await test.step('Complete the nursing order', async () => {
      const detailsPage = await expectNursingOrderDetailsPage(page);
      await detailsPage.verifyCompleteOrderButtonEnabled();
      await detailsPage.clickCompleteOrderButton();

      const nursingOrdersPage = new NursingOrdersPage(page);
      const orderRow = await nursingOrdersPage.getOrderRowByNote(NURSING_ORDER_A.notes);
      await orderRow.verifyStatus('COMPLETED');
    });

    await test.step('Create second nursing order', async () => {
      const nursingOrdersPage = await sideMenu.clickNursingOrders();
      const createOrderPage = await nursingOrdersPage.clickOrderButton();

      await createOrderPage.enterOrderNote(NURSING_ORDER_B.notes);
      const ordersPage = await createOrderPage.clickOrderButton();

      const orderRow = await ordersPage.getOrderRowByNote(NURSING_ORDER_B.notes);
      await orderRow.verifyOrderNote(NURSING_ORDER_B.notes);
      await orderRow.verifyStatus(NURSING_ORDER_B.status);
    });

    await test.step('Delete nursing order', async () => {
      const nursingOrdersPage = await sideMenu.clickNursingOrders();
      const orderRow = await nursingOrdersPage.getOrderRowByNote(NURSING_ORDER_B.notes);
      await orderRow.clickDeleteButton();
      await orderRow.verifyStatus('CANCELLED');
    });
  });

  test('Nursing Order validation', async () => {
    await test.step('Verify empty order cannot be submitted', async () => {
      const nursingOrdersPage = await sideMenu.clickNursingOrders();
      const createOrderPage = await nursingOrdersPage.clickOrderButton();

      await createOrderPage.verifyOrderButtonDisabled(true);
      await createOrderPage.enterOrderNote('Test');
      await createOrderPage.verifyOrderButtonDisabled(false);
      await createOrderPage.clearOrderNote();
      await createOrderPage.verifyOrderButtonDisabled(true);
    });

    await test.step('Verify max length validation', async () => {
      const createOrderPage = await expectNursingOrderCreatePage(page);
      const longNote = 'a'.repeat(151);
      await createOrderPage.enterOrderNote(longNote);
      await createOrderPage.verifyOrderNoteLength(150);
    });

    await test.step('Cancel order creation', async () => {
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
  await page.goto(`in-person/${resourceHandler.appointment.id}/review-and-sign`);
  await inPersonHeader.verifyStatus('pending');
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  const initialSideMenu = new SideMenu(page);
  await initialSideMenu.clickCcAndIntakeNotes();
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
