import { expect, test, Page } from '@playwright/test';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Locators } from '../../utils/locators';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';

test.describe.configure({ mode: 'parallel' });

let page: Page;
let flowClass: PrebookInPersonFlow;
let locator: Locators;
let visitData: Awaited<ReturnType<PrebookInPersonFlow['goToReviewPageInPersonVisit']>>;
let commonLocators: CommonLocatorsHelper;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  flowClass = new PrebookInPersonFlow(page);
  locator = new Locators(page);
  commonLocators = new CommonLocatorsHelper(page);
  visitData = await flowClass.goToReviewPageInPersonVisit();
});

test('RP-1 Check title is visible', async () => {
  await expect(locator.titleReviewScreen).toBeVisible();
});

test('RP-2 Check description is visible', async () => {
  await expect(locator.descReviewScreen).toBeVisible();
});

test('RP-3 Check patient title is visible', async () => {
  await expect(locator.titlePatient).toBeVisible();
});

test('RP-4 Check location title is visible', async () => {
  await expect(locator.titleLocation).toBeVisible();
});

test('RP-5 Check visit details title is visible', async () => {
  await expect(locator.titleVisitDetails).toBeVisible();
});

test('RP-6 Check location value is visible', async () => {
  await flowClass.checkValueIsNotEmpty(locator.locationName);
  await expect(locator.locationName).toBeVisible();
});

test('RP-7 Check prebook slot value is visible', async () => {
  await flowClass.checkValueIsNotEmpty(locator.prebookSlotReviewScreen);
  await expect(locator.prebookSlotReviewScreen).toBeVisible();
});

test('RP-8 Check patient name is correct', async () => {
  const firstName = visitData.firstName;
  const lastName = visitData.lastName;
  await commonLocators.checkPatientNameIsCorrect({ firstName, lastName });
});

test('RP-9 Check slot is correct', async () => {
  await commonLocators.checkSlotIsCorrect(visitData.selectedSlot.selectedSlot);
});

test('RP-10 Check location value is correct', async () => {
  await commonLocators.checkLocationValueIsCorrect(visitData.location);
});

// TODO: currently link is opened like http instead of https. Need to check how it work on demo env
test.skip('RP-11 Check privacy policy link', async () => {
  await commonLocators.checkPrivacyPolicyLink();
});

// TODO: currently link is opened like http instead of https. Need to check how it work on demo env
test.skip('RP-12 Check terms and conditions link', async () => {
  await commonLocators.checkTermsAndConditionsLink();
});
