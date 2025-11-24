import { BrowserContext, expect, Locator, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { dataTestIds } from 'src/constants/data-test-ids';
import { waitForChartDataDeletion, waitForSaveChartDataResponse } from 'test-utils';
import { InPersonAssessmentPage } from 'tests/e2e/page/in-person/InPersonAssessmentPage';
import { expectExamPage } from 'tests/e2e/page/in-person/InPersonExamsPage';
import {
  expectInPersonProgressNotePage,
  InPersonProgressNotePage,
} from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { MedicalConditionsPage } from 'tests/e2e/page/MedicalConditionsPage';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { SurgicalHistoryPage } from 'tests/e2e/page/SurgicalHistoryPage';
import {
  captureAllCheckboxStates,
  ComponentTestResult,
  testCheckboxComponent,
  testDropdownComponent,
  testFormComponent,
  testMultiSelectComponent,
  testTextComponent,
  waitForFieldSave,
} from 'tests/e2e-utils/helpers/exam-tab.test-helpers';
import { MDM_FIELD_DEFAULT_TEXT } from 'utils';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { AllergiesPage } from '../../page/in-person/AllergiesPage';

const PROCESS_ID = `inPersonChartData.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');
const ALLERGY = 'Aspirin';

const MEDICAL_CONDITION = 'Paratyphoid fever A';

let SURGERY: string;

const DIAGNOSIS_CODE = 'J45.901';
const DIAGNOSIS_NAME = 'injury';
const E_M_CODE = '99201';
const CPT_CODE = '24640';
const CPT_CODE_2 = '72146';

const DEFAULT_TIMEOUT = { timeout: 15000 };

test.describe('In-Person Visit Chart Data', async () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
    await resourceHandler.cleanupResources();
  });

  let allergyPage: AllergiesPage;
  let medicalConditionsPage: MedicalConditionsPage;
  let surgicalHistoryPage: SurgicalHistoryPage;
  let sideMenu: SideMenu;
  let progressNotePage: InPersonProgressNotePage;

  test.describe.configure({ mode: 'serial' });

  test.describe('Basic medical data', async () => {
    test.describe('Open visit and fill chart data', async () => {
      test('Allergies', async () => {
        await openVisit(page);
        sideMenu = new SideMenu(page);
        await sideMenu.clickAllergies();
        allergyPage = new AllergiesPage(page);
        medicalConditionsPage = new MedicalConditionsPage(page);
        surgicalHistoryPage = new SurgicalHistoryPage(page);
        progressNotePage = new InPersonProgressNotePage(page);

        await test.step('ALG-1.1 Add allergy', async () => {
          await allergyPage.addAllergy(ALLERGY);
        });
        await test.step('ALG-1.2 Check added allergy is shown in In-Person header', async () => {
          await allergyPage.checkAddedAllergyIsShownInHeader(ALLERGY);
        });
      });
      test('Medical Conditions', async () => {
        await sideMenu.clickMedicalConditions();
        await test.step('MC-1.1 Add Medical Condition', async () => {
          await medicalConditionsPage.addAMedicalCondition(MEDICAL_CONDITION);
        });
      });

      test('Surgical History', async () => {
        await sideMenu.clickSurgicalHistory();
        await test.step('SH-1.1 Add Surgery', async () => {
          SURGERY = await surgicalHistoryPage.addSurgery();
        });
      });
    });

    test.describe('Check progress note page for the filled in data presence', async () => {
      test('ALG-1.3 Verify Progress Note shows Allergy', async () => {
        await sideMenu.clickReviewAndSign();
        await progressNotePage.verifyAddedAllergyIsShown(ALLERGY);
      });

      test('MC-1.2 Verify Progress Note shows Medical Condition', async () => {
        await progressNotePage.verifyAddedMedicalConditionIsShown(MEDICAL_CONDITION);
      });

      test('SH-1.2 Verify Progress Note shows surgeries', async () => {
        await progressNotePage.verifyAddedSurgeryIsShown(SURGERY);
      });
    });

    test.describe('Modify filled in chart data', async () => {
      test('Modify allergies and check header', async () => {
        await test.step('ALG-1.4 Open Allergies page and Remove allergy', async () => {
          await sideMenu.clickAllergies();
          await allergyPage.removeAllergy();
        });
        await test.step('ALG-1.5 Check removed allergy is not shown in In-Person header', async () => {
          await allergyPage.checkRemovedAllergyIsNotShownInHeader(ALLERGY);
        });
      });

      test('MC-1.3 Open Medical Conditions page and Remove Medical Condition', async () => {
        await sideMenu.clickMedicalConditions();
        await medicalConditionsPage.removeMedicalCondition();
      });

      test('SH-1.3 Remove Surgery', async () => {
        await sideMenu.clickSurgicalHistory();
        await surgicalHistoryPage.removeSurgery();
      });
    });

    test.describe('Check progress note page for the modified data', async () => {
      test('ALG-1.6 Verify Progress Note does not show removed Allergy', async () => {
        await sideMenu.clickReviewAndSign();
        const progressNotePage = await expectInPersonProgressNotePage(page);
        await progressNotePage.verifyRemovedAllergyIsNotShown(ALLERGY);
      });

      test('MC-1.4 Verify Progress Note does not show removed Medical Condition', async () => {
        await progressNotePage.verifyRemovedMedicalConditionIsNotShown(MEDICAL_CONDITION);
      });

      test('SH-1.4 Verify Progress Note does not show removed surgery', async () => {
        await progressNotePage.verifyRemovedSurgeryIsNotShown(SURGERY);
      });
    });
  });

  test.describe('Assessment page tests', () => {
    let assessmentPage: InPersonAssessmentPage;

    test('Check assessment page initial state and default MDM saving', async () => {
      assessmentPage = new InPersonAssessmentPage(page);
      await sideMenu.clickAssessment();
      await assessmentPage.expectDiagnosisDropdown();
      await expect(page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis)).not.toBeVisible();
      await expect(page.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosis)).not.toBeVisible();
      await assessmentPage.expectMdmField({ text: MDM_FIELD_DEFAULT_TEXT });
    });

    test('Remove MDM and check missing required fields on review and sign page', async () => {
      await assessmentPage.fillMdmField('');
      await waitForChartDataDeletion(page);

      await sideMenu.clickReviewAndSign();
      await progressNotePage.expectLoaded();
      await progressNotePage.verifyReviewAndSignButtonDisabled();
      await test.step('Verify missing card is visible and has all required missing fields', async () => {
        await expect(page.getByTestId(dataTestIds.progressNotePage.missingCard)).toBeVisible();
        await expect(page.getByTestId(dataTestIds.progressNotePage.emCodeLink)).toBeVisible();
        await expect(page.getByTestId(dataTestIds.progressNotePage.medicalDecisionLink)).toBeVisible();
        await expect(page.getByTestId(dataTestIds.progressNotePage.primaryDiagnosisLink)).toBeVisible();
        await expect(page.getByTestId(dataTestIds.progressNotePage.hpiLink)).toBeVisible();
      });
      await page.getByTestId(dataTestIds.progressNotePage.primaryDiagnosisLink).click();
      await assessmentPage.expectDiagnosisDropdown();
      await assessmentPage.expectEmCodeDropdown();
      await assessmentPage.expectMdmField();
    });

    test('Search and select diagnoses', async () => {
      await sideMenu.clickAssessment();
      await assessmentPage.expectDiagnosisDropdown();

      // Test ICD 10 code search
      await test.step('Search for ICD 10 code', async () => {
        await assessmentPage.selectDiagnosis({ diagnosisCode: DIAGNOSIS_CODE });
        await waitForSaveChartDataResponse(
          page,
          (json) =>
            !!json.chartData.diagnosis?.some((x) =>
              x.code.toLocaleLowerCase().includes(DIAGNOSIS_CODE.toLocaleLowerCase())
            )
        );
      });

      let primaryDiagnosisValue: string | null = null;
      let primaryDiagnosis: Locator | null = null;
      await test.step('Verify primary diagnosis is visible', async () => {
        primaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis);
        await expect(primaryDiagnosis).toBeVisible();

        primaryDiagnosisValue = await primaryDiagnosis.textContent();
        expect(primaryDiagnosisValue).toContain(DIAGNOSIS_CODE);
      });

      // Test diagnosis name search
      await test.step('Search for diagnosis name', async () => {
        await assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS_NAME });
        await waitForSaveChartDataResponse(
          page,
          (json) =>
            !!json.chartData.diagnosis?.some((x) =>
              x.display.toLocaleLowerCase().includes(DIAGNOSIS_NAME.toLocaleLowerCase())
            )
        );
      });

      let secondaryDiagnosis: Locator | null = null;
      let secondaryDiagnosisValue: string | null = null;
      await test.step('Verify secondary diagnosis is visible', async () => {
        secondaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosis);
        await expect(secondaryDiagnosis).toBeVisible();

        secondaryDiagnosisValue = await secondaryDiagnosis.textContent();
        expect(secondaryDiagnosisValue?.toLocaleLowerCase()).toContain(DIAGNOSIS_NAME.toLocaleLowerCase());
      });

      // Verify diagnoses on Review and Sign page
      await test.step('Verify diagnoses on Review and Sign page', async () => {
        await sideMenu.clickReviewAndSign();
        await progressNotePage.expectLoaded();

        // Verify both diagnoses are present
        await expect(page.getByText(primaryDiagnosisValue!, { exact: false })).toBeVisible();
        await expect(page.getByText(secondaryDiagnosisValue!, { exact: false })).toBeVisible();
      });
    });

    test('Change primary diagnosis', async () => {
      await sideMenu.clickAssessment();
      await assessmentPage.expectDiagnosisDropdown();
      // Get initial values
      const initialPrimaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis);
      const initialSecondaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosis);
      const initialPrimaryValue = await initialPrimaryDiagnosis.textContent();
      const initialSecondaryValue = await initialSecondaryDiagnosis.textContent();

      // Make secondary diagnosis primary
      await test.step('Make secondary diagnosis primary', async () => {
        await page.getByTestId(dataTestIds.diagnosisContainer.makePrimaryButton).click();
        await expect(page.getByTestId(dataTestIds.diagnosisContainer.makePrimaryButton)).toBeDisabled();
        await expect(page.getByTestId(dataTestIds.diagnosisContainer.makePrimaryButton)).toBeEnabled();

        // After the primary diagnosis is updated, the secondary diagnosis should be updated, they should be swapped
        const newPrimaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis);
        const newSecondaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosis);
        await expect(newPrimaryDiagnosis).toHaveText(initialSecondaryValue!, { ignoreCase: true });
        await expect(newSecondaryDiagnosis).toHaveText(initialPrimaryValue!, { ignoreCase: true });
      });

      // Verify on Review and Sign page
      await test.step('Verify swapped diagnoses on Review and Sign page', async () => {
        await sideMenu.clickReviewAndSign();
        await progressNotePage.expectLoaded();

        // Verify both diagnoses are present
        await expect(page.getByText(initialSecondaryValue!, { exact: false })).toBeVisible();
        await expect(page.getByText(initialPrimaryValue!, { exact: false })).toBeVisible();
      });
    });

    test('Delete primary diagnosis', async () => {
      await sideMenu.clickAssessment();
      await assessmentPage.expectDiagnosisDropdown();
      const primaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis);
      const primaryDiagnosisValue = await primaryDiagnosis.textContent();

      // Get secondary diagnosis value before deletion
      const secondaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosis);
      const secondaryDiagnosisValue = await secondaryDiagnosis.textContent();

      // Delete primary diagnosis
      await test.step('Delete primary diagnosis', async () => {
        await page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosisDeleteButton).first().click();
        await waitForChartDataDeletion(page);
        await waitForSaveChartDataResponse(page);

        // Verify secondary diagnosis is promoted to primary
        await expect(page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis)).toBeVisible();
        await expect(page.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosis)).not.toBeVisible();

        const newPrimaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis);
        const newPrimaryValue = await newPrimaryDiagnosis.textContent();
        expect(newPrimaryValue?.toLocaleLowerCase()).toEqual(secondaryDiagnosisValue?.toLocaleLowerCase());
      });

      // Verify on Review and Sign page
      await test.step('Verify promoted diagnosis on Review and Sign page, deleted diagnosis is not present', async () => {
        await sideMenu.clickReviewAndSign();
        await progressNotePage.expectLoaded();

        // Verify only one diagnosis is present
        await expect(page.getByText(secondaryDiagnosisValue!, { exact: false })).toBeVisible();
        await expect(page.getByText(primaryDiagnosisValue!, { exact: false })).not.toBeVisible(DEFAULT_TIMEOUT);
      });
    });

    test('Medical Decision Making functionality', async () => {
      await sideMenu.clickAssessment();
      await assessmentPage.expectDiagnosisDropdown();

      // Check default text
      await assessmentPage.expectMdmField({ text: '' });

      // Edit the text
      const newText = 'Updated medical decision making text';
      await assessmentPage.fillMdmField(newText);
      await page.getByTestId(dataTestIds.assessmentCard.medicalDecisionLoading).waitFor({ state: 'visible' });
      await page.getByTestId(dataTestIds.assessmentCard.medicalDecisionLoading).waitFor({ state: 'hidden' });

      // Verify text is updated
      await assessmentPage.expectMdmField({ text: newText });

      // Navigate to Review and Sign to verify text is displayed
      await sideMenu.clickReviewAndSign();
      await progressNotePage.expectLoaded();
      await expect(page.getByText(newText)).toBeVisible();
    });

    test('Add E&M code', async () => {
      await sideMenu.clickAssessment();
      await assessmentPage.expectDiagnosisDropdown();

      // Select E&M code
      await test.step('Select E&M code', async () => {
        await assessmentPage.selectEmCode(E_M_CODE);
      });

      await test.step('Verify E&M code is added', async () => {
        const value = await page.getByTestId(dataTestIds.assessmentCard.emCodeDropdown).locator('input').inputValue();

        // Navigate to Review and Sign to verify code is displayed
        await sideMenu.clickReviewAndSign();
        await progressNotePage.expectLoaded();
        await expect(page.getByText(value)).toBeVisible();
      });
    });

    test('Add CPT codes', async () => {
      await sideMenu.clickAssessment();
      await assessmentPage.expectDiagnosisDropdown();

      // Select CPT code
      await test.step('Select CPT code', async () => {
        await assessmentPage.selectCptCode(CPT_CODE);
        await assessmentPage.selectCptCode(CPT_CODE_2);
      });

      await test.step('Verify CPT codes are added to progress note', async () => {
        const value = await page.getByTestId(dataTestIds.billingContainer.cptCodeEntry(CPT_CODE)).textContent();
        expect(value).toContain(CPT_CODE);

        const value2 = await page.getByTestId(dataTestIds.billingContainer.cptCodeEntry(CPT_CODE_2)).textContent();
        expect(value2).toContain(CPT_CODE_2);

        // Navigate to Review and Sign to verify code is displayed
        await sideMenu.clickReviewAndSign();
        await progressNotePage.expectLoaded();
        await expect(page.getByText(value!)).toBeVisible();
        await expect(page.getByText(value2!)).toBeVisible();
      });
    });

    test('Remove CPT codes', async () => {
      await sideMenu.clickAssessment();
      await assessmentPage.expectDiagnosisDropdown();

      const value = await page.getByTestId(dataTestIds.billingContainer.cptCodeEntry(CPT_CODE)).textContent();
      expect(value).toContain(CPT_CODE);

      const value2 = await page.getByTestId(dataTestIds.billingContainer.cptCodeEntry(CPT_CODE_2)).textContent();
      expect(value2).toContain(CPT_CODE_2);

      await page.getByTestId(dataTestIds.billingContainer.deleteCptCodeButton(CPT_CODE)).click();
      await waitForChartDataDeletion(page);

      await page.getByTestId(dataTestIds.billingContainer.deleteCptCodeButton(CPT_CODE_2)).click();
      await waitForChartDataDeletion(page);

      await sideMenu.clickReviewAndSign();
      await progressNotePage.expectLoaded();
      await expect(page.getByText(value!)).not.toBeVisible();
      await expect(page.getByText(value2!)).not.toBeVisible();
    });
  });

  test.describe('Exam page tests', async () => {
    // Test data - stores results for each component type
    const testResults: {
      checkbox?: ComponentTestResult;
      dropdown?: ComponentTestResult;
      multiSelect?: ComponentTestResult;
      form?: ComponentTestResult;
      text?: ComponentTestResult;
      comment?: { rowIndex: number; text: string };
    } = {};

    test('Should test basic checkbox functionality (abnormal and normal)', async () => {
      await sideMenu.clickExam();
      await expectExamPage(page);
      const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

      // Find first checkbox component
      const checkboxComponent = examTable.locator('[data-testid^="exam-component-checkbox-"]').first();
      const componentExists = await checkboxComponent.count();

      if (componentExists > 0) {
        testResults.checkbox = await testCheckboxComponent(page, examTable);
      }

      // Add a comment if not already added
      if (testResults.checkbox) {
        const row = examTable.getByRole('row').nth(testResults.checkbox.rowIndex);
        const commentCell = row.getByRole('cell').nth(3);
        const textbox = commentCell.getByRole('textbox');
        const comment = `Test comment ${DateTime.now().toMillis()}`;
        await textbox.fill(comment);
        await waitForFieldSave(textbox);
        testResults.comment = { rowIndex: testResults.checkbox.rowIndex, text: comment };
      }
    });

    test('Should test text component if present', async () => {
      const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

      // Find first text component in abnormal column
      const textComponent = examTable
        .locator('tbody [role="row"] [role="cell"]:nth-child(3) [data-testid^="exam-component-text-"]')
        .first();
      const componentExists = await textComponent.count();

      if (componentExists > 0) {
        const result = await testTextComponent(page, examTable);
        if (result) {
          testResults.text = result;
        }
      }
    });

    test('Should test dropdown component if present', async () => {
      const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

      // Find first dropdown component
      const dropdownComponent = examTable.locator('[data-testid^="exam-component-dropdown-"]').first();
      const componentExists = await dropdownComponent.count();

      if (componentExists > 0) {
        testResults.dropdown = await testDropdownComponent(page, examTable);
      }
    });

    test('Should test multi-select component if present', async () => {
      const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

      // Find first multi-select component
      const multiSelectComponent = examTable.locator('[data-testid^="exam-component-multi-select-"]').first();
      const componentExists = await multiSelectComponent.count();

      if (componentExists > 0) {
        // Check if the multi-select has either a checkbox (inactive) or combobox (active)
        const hasCheckbox = (await multiSelectComponent.getByRole('checkbox').count()) > 0;
        const hasCombobox = (await multiSelectComponent.getByRole('combobox').count()) > 0;

        if (hasCheckbox || hasCombobox) {
          testResults.multiSelect = await testMultiSelectComponent(page, examTable);
        }
      }
    });

    test('Should test form component if present', async () => {
      const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

      // Find first form component
      const formComponent = examTable.locator('[data-testid^="exam-component-form-"]').first();
      const componentExists = await formComponent.count();

      if (componentExists > 0) {
        testResults.form = await testFormComponent(page, examTable);
      }
    });

    test('Should persist all component states after page reload', async () => {
      let examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

      // Capture current checkbox states BEFORE reload (if checkbox test was run)
      const preReloadAbnormalStates: boolean[] = [];
      const preReloadNormalStates: boolean[] = [];
      if (testResults.checkbox) {
        const row = examTable.getByRole('row').nth(testResults.checkbox.rowIndex);
        const abnormalCell = row.getByRole('cell').nth(2);
        const normalCell = row.getByRole('cell').nth(1);

        const abnormalCheckboxes = abnormalCell.getByRole('checkbox');
        const abnormalCount = await abnormalCheckboxes.count();
        for (let i = 0; i < abnormalCount; i++) {
          preReloadAbnormalStates.push(await abnormalCheckboxes.nth(i).isChecked());
        }

        const normalCheckboxes = normalCell.getByRole('checkbox');
        const normalCount = await normalCheckboxes.count();
        for (let i = 0; i < normalCount; i++) {
          preReloadNormalStates.push(await normalCheckboxes.nth(i).isChecked());
        }
      }

      // Reload the page
      await page.reload();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable)).toBeVisible();

      examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

      // Verify checkbox persistence - independent test step that checks ALL checkboxes in the entire table
      await test.step('Verify all checkbox states persisted', async () => {
        const checkboxData = testResults.checkbox;
        if (!checkboxData) {
          return;
        }

        const row = examTable.getByRole('row').nth(checkboxData.rowIndex);
        const abnormalCell = row.getByRole('cell').nth(2);
        const normalCell = row.getByRole('cell').nth(1);

        const abnormalCheckboxes = abnormalCell.getByRole('checkbox');
        const normalCheckboxes = normalCell.getByRole('checkbox');

        // Verify ALL abnormal checkboxes match expected states IN THE TESTED ROW
        const abnormalCount = await abnormalCheckboxes.count();
        for (let i = 0; i < abnormalCount; i++) {
          const checkbox = abnormalCheckboxes.nth(i);
          const label = (await checkbox.locator('../..').locator('p').textContent()) || `checkbox ${i}`;

          // Compare against the state BEFORE reload (not initial state from checkbox test)
          const expectedState = preReloadAbnormalStates[i];
          if (expectedState) {
            await expect(
              checkbox,
              `Abnormal checkbox "${label}" (row ${checkboxData.rowIndex}, index ${i}) should be checked (pre-reload state)`
            ).toBeChecked();
          } else {
            await expect(
              checkbox,
              `Abnormal checkbox "${label}" (row ${checkboxData.rowIndex}, index ${i}) should NOT be checked (pre-reload state)`
            ).not.toBeChecked();
          }
        }
        // Verify ALL normal checkboxes match expected states IN THE TESTED ROW
        const normalCount = await normalCheckboxes.count();
        for (let i = 0; i < normalCount; i++) {
          const checkbox = normalCheckboxes.nth(i);
          const label = (await checkbox.locator('../..').locator('p').textContent()) || `checkbox ${i}`;

          // Compare against the state BEFORE reload (not initial state from checkbox test)
          const expectedState = preReloadNormalStates[i];
          if (expectedState) {
            await expect(
              checkbox,
              `Normal checkbox "${label}" (row ${checkboxData.rowIndex}, index ${i}) should be checked (pre-reload state)`
            ).toBeChecked();
          } else {
            await expect(
              checkbox,
              `Normal checkbox "${label}" (row ${checkboxData.rowIndex}, index ${i}) should NOT be checked (pre-reload state)`
            ).not.toBeChecked();
          }
        }

        // Now capture ALL checkbox states from the ENTIRE exam table for progress note verification
        // This must be done AFTER all tests have modified checkboxes, just before going to progress note
        const allCheckboxStates = await captureAllCheckboxStates(examTable);
        checkboxData.abnormalCheckboxLabels = allCheckboxStates.abnormalCheckboxLabels;
        checkboxData.normalCheckboxLabels = allCheckboxStates.normalCheckboxLabels;
      });

      // Verify comment persistence
      if (testResults.comment) {
        const row = examTable.getByRole('row').nth(testResults.comment.rowIndex);
        const commentCell = row.getByRole('cell').nth(3);
        const textbox = commentCell.getByRole('textbox');
        await expect(textbox).toHaveValue(testResults.comment.text);
      }

      // Verify dropdown persistence
      if (testResults.dropdown) {
        // Dropdown component state persisted; value verified later on progress note
      }

      // Verify multi-select persistence
      if (testResults.multiSelect) {
        const row = examTable.getByRole('row').nth(testResults.multiSelect.rowIndex);
        const abnormalCell = row.getByRole('cell').nth(2);

        // Check that selected options are still visible in the Select component
        if (testResults.multiSelect.selectedOptions && testResults.multiSelect.selectedOptions.length > 0) {
          // The multi-select renders selected options in two places:
          // 1. As comma-separated text in the combobox input
          // 2. As visible text elements below the combobox with descriptions

          // Wait for combobox to be visible
          const combobox = abnormalCell.getByRole('combobox');
          await expect(combobox).toBeVisible();

          // Verify combobox displays all selected options
          const selectText = await combobox.textContent();
          for (const option of testResults.multiSelect.selectedOptions) {
            expect(selectText).toContain(option);
          }

          // Verify selected options are also displayed as visible text below the combobox
          // These are rendered as separate elements (not inside the combobox)
          const multiSelectContainer = abnormalCell.locator('[data-testid^="exam-component-multi-select-"]');
          for (const option of testResults.multiSelect.selectedOptions) {
            // Look for the option text outside the combobox/Select component
            const optionTextElement = multiSelectContainer.locator(`text=${option}`).last();
            await expect(optionTextElement).toBeVisible();
          }
        }
      }

      // Verify form persistence
      if (testResults.form) {
        const row = examTable.getByRole('row').nth(testResults.form.rowIndex);
        const abnormalCell = row.getByRole('cell').nth(2);

        // Check that form entry is still visible
        if (testResults.form.formEntryText) {
          await expect(abnormalCell.locator(`p:has-text("${testResults.form.formEntryText}")`)).toBeVisible();
        }
      }

      // All component states persisted after page reload
    });

    test('Should verify all findings on Review and Sign page', async () => {
      // Navigate to Review and Sign tab
      await sideMenu.clickReviewAndSign();
      await progressNotePage.expectLoaded();

      const examinationsContainer = page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer);
      await expect(examinationsContainer).toBeVisible();

      const examinationsText = await examinationsContainer.textContent();
      expect(examinationsText).toBeTruthy();

      // Verify each component type appears in progress note
      if (testResults.checkbox) {
        await test.step('Verify checkbox component appears in progress note', async () => {
          const checkboxData = testResults.checkbox!;

          // Verify checked abnormal checkboxes appear (should have red indicators)
          if (checkboxData.abnormalCheckboxLabels) {
            for (const { label, checked } of checkboxData.abnormalCheckboxLabels) {
              if (checked) {
                // Checked abnormal MUST appear in progress note
                expect(examinationsText).toContain(label);
              } else {
                // Unchecked abnormal MUST NOT appear in progress note
                expect(examinationsText).not.toContain(label);
              }
            }
          }

          // Verify checked normal checkboxes appear (should have green indicators)
          if (checkboxData.normalCheckboxLabels) {
            for (const { label, checked } of checkboxData.normalCheckboxLabels) {
              if (checked) {
                // Checked normal MUST appear in progress note
                expect(examinationsText).toContain(label);
              } else {
                // Unchecked normal MUST NOT appear in progress note
                expect(examinationsText).not.toContain(label);
              }
            }
          }
        });
      }

      if (testResults.text) {
        await test.step('Verify text component appears in progress note', async () => {
          // Verify the entered text value appears in progress note
          if (testResults.text!.textValue) {
            expect(examinationsText).toContain(testResults.text!.textValue);
          }
        });
      }

      if (testResults.comment) {
        await test.step('Verify comment appears in progress note', async () => {
          expect(examinationsText).toContain(testResults.comment!.text);
        });
      }

      if (testResults.dropdown) {
        await test.step('Verify dropdown component appears in progress note', async () => {
          // Verify the selected dropdown value appears in progress note
          if (testResults.dropdown!.dropdownValue) {
            expect(examinationsText).toContain(testResults.dropdown!.dropdownValue);
          }
        });
      }

      if (testResults.multiSelect) {
        await test.step('Verify multi-select component appears in progress note', async () => {
          // Multi-select options should appear in examination text
          if (testResults.multiSelect!.selectedOptions) {
            for (const option of testResults.multiSelect!.selectedOptions) {
              expect(examinationsText).toContain(option);
            }
          }
        });
      }

      if (testResults.form) {
        await test.step('Verify form component appears in progress note', async () => {
          // Form entries should appear in examination text
          // Note: The form entry may have a label prefix (e.g., "Rashes: ") added on the review page
          if (testResults.form!.formEntryText) {
            // Split the form entry by '|' and check that each part appears (case-insensitive)
            const formParts = testResults.form!.formEntryText.split('|').map((part) => part.trim().toLowerCase());
            for (const part of formParts) {
              expect(examinationsText?.toLowerCase() || '').toContain(part);
            }
          }
        });
      }

      // Count tested components
      const _testedComponents = [
        testResults.checkbox,
        testResults.text,
        testResults.dropdown,
        testResults.multiSelect,
        testResults.form,
      ].filter(Boolean).length;

      // Verified component types on Review and Sign page: ${_testedComponents}
    });
  });
});

async function openVisit(page: Page): Promise<void> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  const inPersonHeader = new InPersonHeader(page);
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
}
