import { BrowserContext, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import {
  expectInPersonProgressNotePage,
  InPersonProgressNotePage,
} from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { MedicalConditionsPage } from 'tests/e2e/page/MedicalConditionsPage';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { SurgicalHistoryPage } from 'tests/e2e/page/SurgicalHistoryPage';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { AllergiesPage } from '../../page/in-person/AllergiesPage';

const PROCESS_ID = `inPersonChartData.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');
const ALLERGY = 'Aspirin';

const MEDICAL_CONDITION = 'Paratyphoid fever A';

let SURGERY: string;

test.describe('In-Person Visit Chart Data', async () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    if (process.env.INTEGRATION_TEST === 'true') {
      await resourceHandler.setResourcesFast();
    } else {
      await resourceHandler.setResources();
      await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
    }
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
    await page.close();
    await context.close();
  });

  let allergyPage: AllergiesPage;
  let medicalConditionsPage: MedicalConditionsPage;
  let surgicalHistoryPage: SurgicalHistoryPage;
  let sideMenu: SideMenu;
  let progressNotePage: InPersonProgressNotePage;

  test.describe('Basic medical data', async () => {
    test.describe.configure({ mode: 'serial' });

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
        await sideMenu.clickProgressNote();
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
        await sideMenu.clickProgressNote();
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
});

async function openVisit(page: Page): Promise<void> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  const inPersonHeader = new InPersonHeader(page);
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  await inPersonHeader.clickSwitchModeButton('provider');
}
