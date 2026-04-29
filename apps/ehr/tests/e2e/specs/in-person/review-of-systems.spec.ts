import { BrowserContext, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { InPersonProgressNotePage } from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';
import { InPersonRosConfig } from 'utils';

const resourceHandler = new ResourceHandler(`review-of-systems-${DateTime.now().toMillis()}`);

let context: BrowserContext;
let page: Page;
let sideMenu: SideMenu;

test.beforeAll(async ({ browser }) => {
  await resourceHandler.setResources({ skipPaperwork: true });
  await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

  context = await browser.newContext();
  page = await context.newPage();

  const inPersonHeader = new InPersonHeader(page);
  const progressNotePage = new InPersonProgressNotePage(page);
  await page.goto(`in-person/${resourceHandler.appointment.id}/review-and-sign`);
  await inPersonHeader.verifyStatus('pending');
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  await progressNotePage.expectLoaded();

  sideMenu = new SideMenu(page);
});

test.afterAll(async () => {
  await page.close();
  await context.close();
  await resourceHandler.cleanupResources();
});

test.describe.configure({ mode: 'serial' });

const ROS_SYSTEM_KEYS = Object.keys(InPersonRosConfig);
const firstSystem = Object.values(InPersonRosConfig)[0];
const SYSTEM_LABEL = firstSystem.label;
const [FINDING_A, FINDING_B] = Object.values(firstSystem.items).map((item) => item.label);

test.describe('Review of Systems page', () => {
  test('ROS-1 Tab is present, can be clicked, and the Review of Systems page loads', async () => {
    const rosPage = await sideMenu.clickReviewOfSystems();

    await test.step('ROS-1.1 expected number of system tables are displayed', async () => {
      await rosPage.validateSystemTablesLoaded(ROS_SYSTEM_KEYS.length);
    });

    await test.step('ROS-1.2 confirm ROS section is empty on progress note page', async () => {
      const progressNotePage = await sideMenu.clickReviewAndSign();
      await progressNotePage.expectLoaded();
      await progressNotePage.verifyRosReviewSectionHidden();
    });
  });

  test('ROS-2 Denies/Reports checkboxes are mutually exclusive and row-independent', async () => {
    const rosPage = await sideMenu.clickReviewOfSystems();

    await test.step('ROS-2.1 Checking Denies checks Denies and leaves Reports unchecked', async () => {
      await rosPage.checkDenies(SYSTEM_LABEL, FINDING_A);
      await rosPage.assertDeniesChecked(SYSTEM_LABEL, FINDING_A, true);
      await rosPage.assertReportsChecked(SYSTEM_LABEL, FINDING_A, false);
    });

    await test.step('ROS-2.2 Checking Reports checks Reports and auto-unchecks Denies', async () => {
      await rosPage.checkReports(SYSTEM_LABEL, FINDING_A);
      await rosPage.assertReportsChecked(SYSTEM_LABEL, FINDING_A, true);
      await rosPage.assertDeniesChecked(SYSTEM_LABEL, FINDING_A, false);
    });

    await test.step('ROS-2.3 Clicking the checked Reports unchecks it, leaving neither checked', async () => {
      await rosPage.checkReports(SYSTEM_LABEL, FINDING_A);
      await rosPage.assertReportsChecked(SYSTEM_LABEL, FINDING_A, false);
      await rosPage.assertDeniesChecked(SYSTEM_LABEL, FINDING_A, false);
    });

    await test.step('ROS-2.4 Checking one finding does not affect a different finding in the same system', async () => {
      await rosPage.checkDenies(SYSTEM_LABEL, FINDING_A);
      await rosPage.assertDeniesChecked(SYSTEM_LABEL, FINDING_B, false);
      await rosPage.assertReportsChecked(SYSTEM_LABEL, FINDING_B, false);
    });
  });

  test('ROS-3 Progress note displays ROS findings correctly', async () => {
    await test.step('ROS-3.1 Document one Denies and one Reports finding', async () => {
      const rosPage = await sideMenu.clickReviewOfSystems();
      // FINDING_A: leave as Denies (checked from ROS-2.4); FINDING_B: check Reports
      await rosPage.checkReports(SYSTEM_LABEL, FINDING_B);
      await rosPage.assertDeniesChecked(SYSTEM_LABEL, FINDING_A, true);
      await rosPage.assertReportsChecked(SYSTEM_LABEL, FINDING_B, true);
    });

    const progressNotePage = await sideMenu.clickReviewAndSign();

    await test.step('ROS-3.2 Navigate to progress note and verify ROS section is visible', async () => {
      await progressNotePage.expectLoaded();
      await progressNotePage.verifyRosReviewSectionVisible();
    });

    await test.step('ROS-3.3 Denies finding appears without bold text', async () => {
      await progressNotePage.verifyRosFinding(FINDING_A, false);
    });

    await test.step('ROS-3.4 Reports finding appears with bold text', async () => {
      await progressNotePage.verifyRosFinding(FINDING_B, true);
    });
  });
});
