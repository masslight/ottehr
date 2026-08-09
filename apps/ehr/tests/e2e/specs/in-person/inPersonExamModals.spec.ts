import { BrowserContext, expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { dataTestIds } from 'src/constants/data-test-ids';
import { expectExamPage } from 'tests/e2e/page/in-person/InPersonExamsPage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

const PROCESS_ID = `inPersonExamModals.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

test.describe('In-Person Exam Modal Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let sideMenu: SideMenu;

  // State shared across serial tests
  const state: {
    modalLabel?: string;
    selectedModalItems: string[];
    pairedModalLabel?: string;
    selectedLeftItems: string[];
    selectedRightItems: string[];
  } = {
    selectedModalItems: [],
    selectedLeftItems: [],
    selectedRightItems: [],
  };

  test.beforeAll(async ({ browser }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

    context = await browser.newContext();
    page = await context.newPage();

    // Open the visit and assign practitioners
    await page.goto(`in-person/${resourceHandler.appointment.id}`);
    const inPersonHeader = new InPersonHeader(page);
    await inPersonHeader.selectIntakePractitioner();
    await inPersonHeader.selectProviderPractitioner();

    // Navigate to exam tab
    sideMenu = new SideMenu(page);
    await sideMenu.clickExam();
    await expectExamPage(page);
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test('Should open a single modal via pencil icon and verify dialog', async () => {
    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    // Find a checkbox-with-modal item (single, not paired) by its data-testid
    const modalExamComponent = examTable.locator('[data-testid^="exam-component-checkbox-with-modal-"]').first();
    const modalExists = await modalExamComponent.count();

    if (modalExists === 0) {
      test.skip(true, 'No checkbox-with-modal components found in exam table');
      return;
    }

    // The pencil icon is an IconButton with EditOutlined SVG, rendered as a sibling of the checkbox
    const editButton = modalExamComponent.locator('button').filter({
      has: page.locator('svg[data-testid="EditOutlinedIcon"]'),
    });
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Verify dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify the dialog has a title (the DialogTitle contains the config.label text)
    const dialogTitle = dialog.locator('[class*="MuiDialogTitle"]');
    await expect(dialogTitle).toBeVisible();
    const titleText = await dialogTitle.textContent();
    expect(titleText?.trim().length).toBeGreaterThan(0);
    state.modalLabel = titleText?.trim();

    // Close the dialog via the close button (IconButton with Close icon inside DialogTitle)
    const closeButton = dialog.locator('button').filter({
      has: page.locator('svg[data-testid="CloseIcon"]'),
    });
    await closeButton.click();

    // Verify dialog is closed
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('Should select items in modal, close, and verify parent checked with sub-items displayed', async () => {
    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    // Find the first single checkbox-with-modal component
    const modalExamComponent = examTable.locator('[data-testid^="exam-component-checkbox-with-modal-"]').first();
    const modalExists = await modalExamComponent.count();

    if (modalExists === 0) {
      test.skip(true, 'No checkbox-with-modal components found in exam table');
      return;
    }

    // Open the modal via pencil icon
    const editButton = modalExamComponent.locator('button').filter({
      has: page.locator('svg[data-testid="EditOutlinedIcon"]'),
    });
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Find checkboxes inside the modal dialog's table body
    // Each row has a label cell and a content cell with FormControlLabel checkboxes
    const modalCheckboxes = dialog.locator('tbody').getByRole('checkbox');
    const checkboxCount = await modalCheckboxes.count();
    const itemsToSelect = Math.min(2, checkboxCount);

    // Select 2 checkboxes
    state.selectedModalItems = [];
    for (let i = 0; i < itemsToSelect; i++) {
      const checkbox = modalCheckboxes.nth(i);
      const isChecked = await checkbox.isChecked();
      if (!isChecked) {
        await checkbox.click();
      }
      // Get the label text from the FormControlLabel (the Typography sibling)
      const label = await checkbox
        .locator('..')
        .locator('..')
        .locator('span.MuiTypography-root, p')
        .first()
        .textContent();
      if (label) {
        state.selectedModalItems.push(label.trim());
      }
    }

    expect(state.selectedModalItems.length).toBeGreaterThan(0);

    // Close the modal (handleCloseModal saves draft components on close)
    const closeButton = dialog.locator('button').filter({
      has: page.locator('svg[data-testid="CloseIcon"]'),
    });
    await closeButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Verify the parent checkbox (StatelessExamCheckbox) is now checked
    const parentCheckbox = modalExamComponent.getByRole('checkbox').first();
    await expect(parentCheckbox).toBeChecked({ timeout: 10000 });

    // Verify sub-items appear as Typography elements below the parent
    // Selected items render with a checkmark prefix and pl: 3 styling
    for (const item of state.selectedModalItems) {
      const subItem = modalExamComponent.locator('p').filter({ hasText: item });
      await expect(subItem.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('Should deselect all items in modal and verify parent unchecks', async () => {
    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    const modalExamComponent = examTable.locator('[data-testid^="exam-component-checkbox-with-modal-"]').first();
    const modalExists = await modalExamComponent.count();

    if (modalExists === 0) {
      test.skip(true, 'No checkbox-with-modal components found in exam table');
      return;
    }

    // Open the modal
    const editButton = modalExamComponent.locator('button').filter({
      has: page.locator('svg[data-testid="EditOutlinedIcon"]'),
    });
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Uncheck all checked checkboxes in the modal
    const modalCheckboxes = dialog.locator('tbody').getByRole('checkbox');
    const checkboxCount = await modalCheckboxes.count();

    for (let i = 0; i < checkboxCount; i++) {
      const checkbox = modalCheckboxes.nth(i);
      const isChecked = await checkbox.isChecked();
      if (isChecked) {
        await checkbox.click();
      }
    }

    // Close the modal
    const closeButton = dialog.locator('button').filter({
      has: page.locator('svg[data-testid="CloseIcon"]'),
    });
    await closeButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Verify the parent checkbox is unchecked
    const parentCheckbox = modalExamComponent.getByRole('checkbox').first();
    await expect(parentCheckbox).not.toBeChecked({ timeout: 10000 });

    // Verify no sub-items are displayed (Typography elements with checkmarks should be gone)
    for (const item of state.selectedModalItems) {
      const subItem = modalExamComponent.locator('p').filter({ hasText: item });
      await expect(subItem).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('Should open paired L/R modal and verify two-column layout', async () => {
    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    // Find a paired modal component
    const pairedModalComponent = examTable.locator('[data-testid^="exam-component-paired-modal-"]').first();
    const pairedExists = await pairedModalComponent.count();

    if (pairedExists === 0) {
      test.skip(true, 'No paired exam-component-paired-modal components found in exam table');
      return;
    }

    // Open the paired modal via pencil icon
    const editButton = pairedModalComponent.locator('button').filter({
      has: page.locator('svg[data-testid="EditOutlinedIcon"]'),
    });
    await expect(editButton).toBeVisible();
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog title
    const dialogTitle = dialog.locator('[class*="MuiDialogTitle"]');
    const titleText = await dialogTitle.textContent();
    expect(titleText?.trim().length).toBeGreaterThan(0);
    state.pairedModalLabel = titleText?.trim();

    // Verify "Left" and "Right" column headers exist in the table header
    // The ExamPairedModalCheckbox renders a TableHead with three cells: empty, "Left", "Right"
    const tableHeaders = dialog.locator('thead th, thead td');
    const headerTexts: string[] = [];
    const headerCount = await tableHeaders.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await tableHeaders.nth(i).textContent();
      if (text) headerTexts.push(text.trim());
    }

    expect(headerTexts).toContain('Left');
    expect(headerTexts).toContain('Right');

    // Close the dialog
    const closeButton = dialog.locator('button').filter({
      has: page.locator('svg[data-testid="CloseIcon"]'),
    });
    await closeButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('Should select items in paired modal L and R columns', async () => {
    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    const pairedModalComponent = examTable.locator('[data-testid^="exam-component-paired-modal-"]').first();
    const pairedExists = await pairedModalComponent.count();

    if (pairedExists === 0) {
      test.skip(true, 'No paired exam-component-paired-modal components found in exam table');
      return;
    }

    // Open the paired modal
    const editButton = pairedModalComponent.locator('button').filter({
      has: page.locator('svg[data-testid="EditOutlinedIcon"]'),
    });
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // The paired modal table body rows have: section label (cell 0), Left (cell 1), Right (cell 2)
    const bodyRows = dialog.locator('tbody tr');
    const rowCount = await bodyRows.count();

    state.selectedLeftItems = [];
    state.selectedRightItems = [];

    if (rowCount > 0) {
      const firstRow = bodyRows.first();
      const cells = firstRow.locator('td');
      const cellCount = await cells.count();

      if (cellCount >= 3) {
        // Select a checkbox in the Left column (index 1)
        const leftCell = cells.nth(1);
        const leftCheckboxes = leftCell.getByRole('checkbox');
        const leftCheckboxCount = await leftCheckboxes.count();

        if (leftCheckboxCount > 0) {
          const leftCheckbox = leftCheckboxes.first();
          await leftCheckbox.click();
          const leftLabel = await leftCheckbox
            .locator('..')
            .locator('..')
            .locator('span.MuiTypography-root, p')
            .first()
            .textContent();
          if (leftLabel) {
            state.selectedLeftItems.push(leftLabel.trim());
          }
        }

        // Select a checkbox in the Right column (index 2)
        const rightCell = cells.nth(2);
        const rightCheckboxes = rightCell.getByRole('checkbox');
        const rightCheckboxCount = await rightCheckboxes.count();

        if (rightCheckboxCount > 0) {
          const rightCheckbox = rightCheckboxes.first();
          await rightCheckbox.click();
          const rightLabel = await rightCheckbox
            .locator('..')
            .locator('..')
            .locator('span.MuiTypography-root, p')
            .first()
            .textContent();
          if (rightLabel) {
            state.selectedRightItems.push(rightLabel.trim());
          }
        }
      }
    }

    // Close the modal (saves on close via handleCloseModal)
    const closeButton = dialog.locator('button').filter({
      has: page.locator('svg[data-testid="CloseIcon"]'),
    });
    await closeButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Verify parent checkbox is checked
    const parentCheckbox = pairedModalComponent.getByRole('checkbox').first();
    await expect(parentCheckbox).toBeChecked({ timeout: 10000 });

    // Verify "L:" prefixed Typography items appear below the component
    for (const item of state.selectedLeftItems) {
      const leftSubItem = pairedModalComponent.locator('p').filter({ hasText: 'L:' }).filter({ hasText: item });
      await expect(leftSubItem.first()).toBeVisible({ timeout: 5000 });
    }

    // Verify "R:" prefixed Typography items appear below the component
    for (const item of state.selectedRightItems) {
      const rightSubItem = pairedModalComponent.locator('p').filter({ hasText: 'R:' }).filter({ hasText: item });
      await expect(rightSubItem.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('Should verify exam modal findings on Review & Sign page', async () => {
    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    // Re-select items in the single modal (test 3 cleared them) so we have findings to verify
    const modalExamComponent = examTable.locator('[data-testid^="exam-component-checkbox-with-modal-"]').first();
    const modalExists = await modalExamComponent.count();

    if (modalExists > 0) {
      const editButton = modalExamComponent.locator('button').filter({
        has: page.locator('svg[data-testid="EditOutlinedIcon"]'),
      });
      await editButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Select first 2 checkboxes
      const modalCheckboxes = dialog.locator('tbody').getByRole('checkbox');
      const checkboxCount = await modalCheckboxes.count();
      const itemsToSelect = Math.min(2, checkboxCount);
      state.selectedModalItems = [];

      for (let i = 0; i < itemsToSelect; i++) {
        const checkbox = modalCheckboxes.nth(i);
        if (!(await checkbox.isChecked())) {
          await checkbox.click();
        }
        const label = await checkbox
          .locator('..')
          .locator('..')
          .locator('span.MuiTypography-root, p')
          .first()
          .textContent();
        if (label) {
          state.selectedModalItems.push(label.trim());
        }
      }

      const closeButton = dialog.locator('button').filter({
        has: page.locator('svg[data-testid="CloseIcon"]'),
      });
      await closeButton.click();
      await expect(dialog).not.toBeVisible({ timeout: 5000 });

      // Wait for the parent checkbox to reflect the saved state
      const parentCheckbox = modalExamComponent.getByRole('checkbox').first();
      await expect(parentCheckbox).toBeChecked({ timeout: 10000 });
    }

    // Navigate to Review & Sign page
    await sideMenu.clickReviewAndSign();

    // Wait for the progress note page to load
    await page.waitForURL(/\/in-person\/.*\/review-and-sign/);
    await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible({ timeout: 60000 });

    // Check the Examinations section
    const examinationsContainer = page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer);
    await expect(examinationsContainer).toBeVisible({ timeout: 10000 });

    const examinationsText = await examinationsContainer.textContent();
    expect(examinationsText).toBeTruthy();

    // Verify single modal selected items appear in the examinations text
    if (state.selectedModalItems.length > 0) {
      for (const item of state.selectedModalItems) {
        expect(examinationsText, `Expected modal item "${item}" to appear in examinations section`).toContain(item);
      }
    }

    // Verify paired modal selected items appear in the examinations text
    for (const item of state.selectedLeftItems) {
      expect(examinationsText, `Expected left paired item "${item}" to appear in examinations section`).toContain(item);
    }

    for (const item of state.selectedRightItems) {
      expect(examinationsText, `Expected right paired item "${item}" to appear in examinations section`).toContain(
        item
      );
    }
  });
});
