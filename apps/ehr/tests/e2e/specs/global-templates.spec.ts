import { BrowserContext, expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { dataTestIds } from 'src/constants/data-test-ids';
import { testCheckboxComponent, waitForFieldSave } from 'tests/e2e-utils/helpers/exam-tab.test-helpers';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { GlobalTemplatesAdminPage, navigateToGlobalTemplatesAdmin } from '../page/GlobalTemplatesAdminPage';
import { InPersonAssessmentPage } from '../page/in-person/InPersonAssessmentPage';
import { expectExamPage } from '../page/in-person/InPersonExamsPage';
import { InPersonHeader } from '../page/InPersonHeader';
import { SideMenu } from '../page/SideMenu';

const TIMESTAMP = DateTime.now().toMillis();
const PROCESS_ID_1 = `global-templates-1-${TIMESTAMP}`;
const PROCESS_ID_2 = `global-templates-2-${TIMESTAMP}`;
const resourceHandler1 = new ResourceHandler(PROCESS_ID_1, 'in-person');
const resourceHandler2 = new ResourceHandler(PROCESS_ID_2, 'in-person');

const TEMPLATE_NAME = `E2E Template ${TIMESTAMP}`;
const RENAMED_TEMPLATE_NAME = `E2E Template Renamed ${TIMESTAMP}`;

// Chart data to fill on the first visit and verify on the second
const HPI_TEXT = 'Patient presents with acute cough for 3 days. No fever or shortness of breath.';
const MDM_TEXT = 'Low complexity MDM. Single acute uncomplicated problem.';
const DIAGNOSIS_CODE = 'J06.9';
const EM_CODE = '99202';
const CPT_CODE = '24640';

const DEFAULT_TIMEOUT = { timeout: 30000 };

async function openVisit(page: Page, resourceHandler: ResourceHandler): Promise<void> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  const inPersonHeader = new InPersonHeader(page);
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
}

test.describe('Global Templates E2E', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;
  let context: BrowserContext;
  let sideMenu: SideMenu;

  test.beforeAll(async ({ browser }) => {
    // Create both appointments in parallel
    await Promise.all([resourceHandler1.setResources(), resourceHandler2.setResources()]);

    await Promise.all([
      resourceHandler1.waitTillAppointmentPreprocessed(resourceHandler1.appointment.id!),
      resourceHandler2.waitTillAppointmentPreprocessed(resourceHandler2.appointment.id!),
    ]);

    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
    await Promise.all([resourceHandler1.cleanupResources(), resourceHandler2.cleanupResources()]);
  });

  test('Fill chart data on first visit', async () => {
    await openVisit(page, resourceHandler1);
    sideMenu = new SideMenu(page);

    await test.step('Fill HPI', async () => {
      const hpiPage = await sideMenu.clickHpiAndTemplates();
      await hpiPage.fillHPI(HPI_TEXT);
      // Wait for debounced save to complete
      const hpiTextField = page.getByTestId(dataTestIds.hpiAndTemplatesPage.hpiNotes);
      await waitForFieldSave(hpiTextField.locator('textarea').first());
    });

    await test.step('Toggle exam checkbox', async () => {
      await sideMenu.clickExam();
      await expectExamPage(page);
      const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);
      const checkboxComponent = examTable.locator('[data-testid^="exam-component-checkbox-"]').first();
      const componentExists = await checkboxComponent.count();
      if (componentExists > 0) {
        await testCheckboxComponent(page, examTable);
      }
    });

    await test.step('Fill assessment data', async () => {
      await sideMenu.clickAssessment();
      const assessmentPage = new InPersonAssessmentPage(page);

      // Fill MDM
      await assessmentPage.fillMdmField(MDM_TEXT);
      const mdmField = page.getByTestId(dataTestIds.assessmentCard.medicalDecisionField);
      await waitForFieldSave(mdmField.locator('textarea:visible'));

      // Select diagnosis — selectDiagnosis triggers a save; the subsequent
      // selectEmCode/selectCptCode calls wait for their own save confirmation
      // (delete-button enabled), so no extra waitForSaveChartDataResponse needed.
      await assessmentPage.selectDiagnosis({ diagnosisCode: DIAGNOSIS_CODE });

      // Select E&M code
      await assessmentPage.selectEmCode(EM_CODE);

      // Select CPT code
      await assessmentPage.selectCptCode(CPT_CODE);
    });
  });

  test('Create global template from chart', async () => {
    const hpiPage = await sideMenu.clickHpiAndTemplates();
    await hpiPage.createTemplateFromNote(TEMPLATE_NAME);
  });

  test('Verify template on admin page', async () => {
    const adminPage = await navigateToGlobalTemplatesAdmin(page);

    await test.step('Filter and find the template', async () => {
      await adminPage.filterTemplates(TEMPLATE_NAME);
      await adminPage.verifyTemplateExists(TEMPLATE_NAME);
    });

    await test.step('Click Scan for Stale Templates btn', async () => {
      await adminPage.clickScanForStaleTemplates();
    });

    await test.step('Verify version status chip', async () => {
      const row = adminPage.findTemplateRow(TEMPLATE_NAME);
      const currentChip = row.getByText('Current');
      const staleChip = row.getByText('Stale');
      const hasCurrent = await currentChip.isVisible().catch(() => false);
      const hasStale = await staleChip.isVisible().catch(() => false);
      expect(hasCurrent || hasStale).toBe(true);
    });
  });

  test('Rename template', async () => {
    const adminPage = new GlobalTemplatesAdminPage(page);
    await adminPage.renameTemplate(TEMPLATE_NAME, RENAMED_TEMPLATE_NAME);

    await test.step('Verify renamed template appears', async () => {
      await adminPage.filterTemplates(RENAMED_TEMPLATE_NAME);
      await adminPage.verifyTemplateExists(RENAMED_TEMPLATE_NAME);
    });

    await test.step('Verify old name is gone', async () => {
      await adminPage.filterTemplates(TEMPLATE_NAME);
      await adminPage.verifyTemplateNotPresent(TEMPLATE_NAME);
    });
  });

  test('Apply template to second visit', async () => {
    await openVisit(page, resourceHandler2);
    sideMenu = new SideMenu(page);

    const hpiPage = await sideMenu.clickHpiAndTemplates();
    await hpiPage.applyTemplate(RENAMED_TEMPLATE_NAME);
  });

  test('Verify template data applied correctly', async () => {
    await test.step('Verify HPI content', async () => {
      // We should still be on or navigate to HPI page
      const hpiPage = await sideMenu.clickHpiAndTemplates();
      await hpiPage.verifyHpiContent(HPI_TEXT);
    });

    await test.step('Verify MDM content', async () => {
      await sideMenu.clickAssessment();
      const assessmentPage = new InPersonAssessmentPage(page);
      await assessmentPage.expectMdmField({ text: MDM_TEXT });
    });

    await test.step('Verify diagnosis is present', async () => {
      const primaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis);
      await expect(primaryDiagnosis).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Verify E&M code is set', async () => {
      const emCodeDropdown = page.getByTestId(dataTestIds.assessmentCard.emCodeDropdown);
      const emCodeInput = emCodeDropdown.locator('input');
      await expect(emCodeInput).toHaveValue(new RegExp(EM_CODE), DEFAULT_TIMEOUT);
    });

    await test.step('Verify CPT code is present', async () => {
      const cptCodeEntry = page.getByTestId(dataTestIds.billingContainer.cptCodeEntry(CPT_CODE));
      await expect(cptCodeEntry).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Verify exam data is present', async () => {
      await sideMenu.clickExam();
      await expectExamPage(page);
      const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);
      // Verify at least one checkbox in the abnormal column (3rd cell) is checked
      const rows = examTable.locator('tbody').getByRole('row');
      const firstRow = rows.first();
      const abnormalCell = firstRow.getByRole('cell').nth(2);
      const checkboxes = abnormalCell.getByRole('checkbox');
      const count = await checkboxes.count();
      let foundChecked = false;
      for (let i = 0; i < count; i++) {
        if (await checkboxes.nth(i).isChecked()) {
          foundChecked = true;
          break;
        }
      }
      expect(foundChecked).toBe(true);
    });
  });

  test('Delete template and verify removal', async () => {
    const adminPage = await navigateToGlobalTemplatesAdmin(page);
    await adminPage.filterTemplates(RENAMED_TEMPLATE_NAME);
    await adminPage.verifyTemplateExists(RENAMED_TEMPLATE_NAME);

    await adminPage.deleteTemplate(RENAMED_TEMPLATE_NAME);

    await test.step('Verify template no longer appears', async () => {
      await adminPage.filterTemplates(RENAMED_TEMPLATE_NAME);
      await adminPage.verifyTemplateNotPresent(RENAMED_TEMPLATE_NAME);
    });
  });
});
