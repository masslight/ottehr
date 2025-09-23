import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { CssHeader } from 'tests/e2e/page/CssHeader';
import { openCreateVaccineOrderPage } from 'tests/e2e/page/in-person/Immunization/EditVaccineOrderPage';
import { openImmunizationPage } from 'tests/e2e/page/in-person/Immunization/ImmunizationPage';
import { InPersonProgressNotePage } from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';

const DTAP = 'No drugId vaccine'; //'Dtap (Diptheria, Tetanus, Pertussis)';
const DOSE_0_5 = '0.5';
const MG = 'mg';
const BODY_CAVITY_ROUTE = 'Body cavity route (qualifier value)';
const EAR_LEFT = 'Ear, Left';
const TEST_VACCINE_INSTRUCTIONS = 'test vaccine instructions';
const PENDING = 'PENDING';

const TDAP = 'Tdap (Tetanus, Diphtheria, Pertussis)';
const DOSE_1_0 = '1';
const ML = 'mL';
const CAUDAL_ROUTE = 'Caudal route (qualifier value)';
const EYE_LEFT = 'Eye, Left';
const TEST_VACCINE_INSTRUCTIONS_EDITED = 'test vaccine instructions edited';

const resourceHandler = new ResourceHandler(`immunization-mutating-${DateTime.now().toMillis()}`);

test.describe('Immunization Page mutating tests', () => {
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

  test('Immunization happy path', async ({ page }) => {
    const createOrderPage = await openCreateVaccineOrderPage(resourceHandler.appointment.id!, page);
    await createOrderPage.orderDetailsSection.selectVaccine(DTAP);
    await createOrderPage.orderDetailsSection.enterDose(DOSE_0_5);
    await createOrderPage.orderDetailsSection.selectUnits(MG);
    await createOrderPage.orderDetailsSection.selectRoute(BODY_CAVITY_ROUTE);
    await createOrderPage.orderDetailsSection.selectLocation(EAR_LEFT);
    await createOrderPage.orderDetailsSection.enterInstructions(TEST_VACCINE_INSTRUCTIONS);
    await createOrderPage.clickConfirmationButton();

    let immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
    await immunizationPage.verifyVaccinePresent({
      vaccineName: DTAP,
      doseRoute: DOSE_0_5 + ' ' + MG + ' / ' + BODY_CAVITY_ROUTE,
      instructions: TEST_VACCINE_INSTRUCTIONS,
      status: PENDING,
    });

    let editOrderPage = await immunizationPage.clickEditOrderButton(DTAP);
    await editOrderPage.orderDetailsSection.verifyVaccine(DTAP);
    await editOrderPage.orderDetailsSection.verifyDose(DOSE_0_5);
    await editOrderPage.orderDetailsSection.verifyUnits(MG);
    await editOrderPage.orderDetailsSection.verifyRoute(BODY_CAVITY_ROUTE);
    await editOrderPage.orderDetailsSection.verifyLocation(EAR_LEFT);
    await editOrderPage.orderDetailsSection.verifyInstructions(TEST_VACCINE_INSTRUCTIONS);
    // edit order, click save
    await editOrderPage.orderDetailsSection.selectVaccine(TDAP);
    await editOrderPage.orderDetailsSection.enterDose(DOSE_1_0);
    await editOrderPage.orderDetailsSection.selectUnits(ML);
    await editOrderPage.orderDetailsSection.selectRoute(CAUDAL_ROUTE);
    await editOrderPage.orderDetailsSection.selectLocation(EYE_LEFT);
    await editOrderPage.orderDetailsSection.enterInstructions(TEST_VACCINE_INSTRUCTIONS_EDITED);
    await editOrderPage.clickConfirmationButton();

    // check immunization table
    immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
    await immunizationPage.verifyVaccinePresent({
      vaccineName: TDAP,
      doseRoute: DOSE_1_0 + ' ' + ML + ' / ' + CAUDAL_ROUTE,
      instructions: TEST_VACCINE_INSTRUCTIONS_EDITED,
      status: PENDING,
    });

    editOrderPage = await immunizationPage.clickEditOrderButton(TDAP);
    await editOrderPage.orderDetailsSection.verifyVaccine(TDAP);
    await editOrderPage.orderDetailsSection.verifyDose(DOSE_1_0);
    await editOrderPage.orderDetailsSection.verifyUnits(ML);
    await editOrderPage.orderDetailsSection.verifyRoute(CAUDAL_ROUTE);
    await editOrderPage.orderDetailsSection.verifyLocation(EYE_LEFT);
    await editOrderPage.orderDetailsSection.verifyInstructions(TEST_VACCINE_INSTRUCTIONS_EDITED);
  });
});

async function setupPractitioners(page: Page): Promise<void> {
  const progressNotePage = new InPersonProgressNotePage(page);
  const cssHeader = new CssHeader(page);
  await page.goto(`in-person/${resourceHandler.appointment.id}/progress-note`);
  await cssHeader.verifyStatus('pending');
  await cssHeader.selectIntakePractitioner();
  await cssHeader.selectProviderPractitioner();
  await cssHeader.clickSwitchModeButton('provider');
  await progressNotePage.expectLoaded();
}
