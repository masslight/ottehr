import { expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { expectExamPage } from 'tests/e2e/page/in-person/InPersonExamsPage';
import { InPersonProgressNotePage } from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import {
  discoverAndTestExamSections,
  type TestSection,
  verifyExamFindingsOnReviewPage,
  verifyExamSectionsPersistence,
  waitForFieldSave,
} from '../../../e2e-utils/helpers/exam-tab.test-helpers';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

let sideMenu: SideMenu;
let progressNotePage: InPersonProgressNotePage;

test.describe('Persistence tests', async () => {
  const PROCESS_ID = `in-person_examTab.spec.ts-persistence-tests-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');
  let page: Page;

  // Test data - will be filled dynamically
  const testData: { sections: TestSection[] } = { sections: [] };

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    if (process.env.INTEGRATION_TEST === 'true') {
      await resourceHandler.setResourcesFast();
    } else {
      await resourceHandler.setResources();
      await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
    }
    progressNotePage = new InPersonProgressNotePage(page);
    const inPersonHeader = new InPersonHeader(page);
    sideMenu = new SideMenu(page);
    await page.goto(`in-person/${resourceHandler.appointment.id}/progress-note`);
    await inPersonHeader.verifyStatus('pending');
    await inPersonHeader.selectIntakePractitioner();
    await inPersonHeader.selectProviderPractitioner();
    await inPersonHeader.clickSwitchModeButton('provider');
    await progressNotePage.expectLoaded();
    await sideMenu.clickExam();
    await expectExamPage(page);
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test('Should discover all sections and test abnormal and normal checkboxes with comments', async () => {
    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    // Use helper to discover and test all exam sections
    const sections = await discoverAndTestExamSections(page, examTable);
    testData.sections = sections;

    expect(testData.sections.length).toBeGreaterThan(0);
    console.log(`Tested ${testData.sections.length} sections with abnormal findings`);
  });

  test('Should delete and re-enter a comment', async () => {
    if (testData.sections.length === 0) {
      test.skip();
      return;
    }

    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);
    const firstSection = testData.sections[0];
    const row = examTable.getByRole('row').nth(firstSection.rowIndex);
    const commentCell = row.getByRole('cell').nth(3);
    const textbox = commentCell.getByRole('textbox');

    // Clear the comment
    await textbox.clear();
    await waitForFieldSave(textbox);

    // Verify it's empty
    await expect(textbox).toHaveValue('');

    // Re-enter the comment with updated suffix
    const updatedComment = `${firstSection.comment} - updated`;
    await textbox.fill(updatedComment);
    await waitForFieldSave(textbox);

    // Update test data
    testData.sections[0].comment = updatedComment;

    await expect(textbox).toHaveValue(updatedComment);
  });

  test('Should persist all abnormal findings and comments after page reload', async () => {
    if (testData.sections.length === 0) {
      test.skip();
      return;
    }

    // Reload the page
    await page.reload();

    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable)).toBeVisible();

    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    // Use helper to verify persistence
    await verifyExamSectionsPersistence(page, examTable, testData.sections);
  });

  test('Should verify all findings on Review and Sign page', async () => {
    if (testData.sections.length === 0) {
      test.skip();
      return;
    }

    // Navigate to Review and Sign tab
    await sideMenu.clickProgressNote();
    await progressNotePage.expectLoaded();

    const examinationsContainer = page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer);
    await expect(examinationsContainer).toBeVisible();

    // Use helper to verify findings on review page
    await verifyExamFindingsOnReviewPage(examinationsContainer, testData.sections);
  });
});
