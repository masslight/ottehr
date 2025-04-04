import { expect, Page, test } from '@playwright/test';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Locators } from '../../utils/locators';

let page: Page;
let flowClass: PrebookInPersonFlow;
let locator: Locators;
let visitData: Awaited<ReturnType<PrebookInPersonFlow['goToReviewPage']>>;
let commonLocators: CommonLocatorsHelper;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  flowClass = new PrebookInPersonFlow(page);
  locator = new Locators(page);
  commonLocators = new CommonLocatorsHelper(page);
  visitData = await flowClass.goToReviewPage();
});

test('Review and Submit Screen check data is correct', async () => {
  await test.step('Check title is visible', async () => {
    await expect.soft(locator.flowHeading).toHaveText('Review and submit');
  });

  await test.step('Check description is visible', async () => {
    await expect.soft(locator.descReviewScreen).toBeVisible();
  });

  await test.step('Check patient title is visible', async () => {
    await expect.soft(locator.titlePatient).toBeVisible();
  });

  await test.step('Check location title is visible', async () => {
    await expect.soft(locator.titleLocation).toBeVisible();
  });

  await test.step('Check visit details title is visible', async () => {
    await expect.soft(locator.titleVisitDetails).toBeVisible();
  });

  await test.step('Check location value is visible', async () => {
    await flowClass.checkValueIsNotEmpty(locator.locationName);
    await expect.soft(locator.locationName).toBeVisible();
  });

  await test.step('Check prebook slot value is visible', async () => {
    await flowClass.checkValueIsNotEmpty(locator.prebookSlotReviewScreen);
    await expect.soft(locator.prebookSlotReviewScreen).toBeVisible();
  });

  await test.step('Check patient name is correct', async () => {
    const firstName = visitData.firstName;
    const lastName = visitData.lastName;
    await commonLocators.checkPatientNameIsCorrect({ firstName, lastName });
  });

  await test.step('Check slot is correct', async () => {
    await commonLocators.checkSlotIsCorrect(visitData.selectedSlot?.selectedSlot);
  });

  await test.step('Check location value is correct', async () => {
    await commonLocators.checkLocationValueIsCorrect(visitData.location ?? null);
  });

  await test.step('Check privacy policy link', async () => {
    await commonLocators.checkLinkOpensPdf(locator.privacyPolicyReviewScreen);
  });

  await test.step('Check terms and conditions link', async () => {
    await commonLocators.checkLinkOpensPdf(locator.termsAndConditions);
  });
});
