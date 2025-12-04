import { expect, Page, test } from '@playwright/test';
import { getPrivacyPolicyLinkDefForLocation, getTermsAndConditionsLinkDefForLocation } from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Locators } from '../../utils/locators';

let page: Page;
let flowClass: PrebookInPersonFlow;
let locator: Locators;
let visitData: Awaited<ReturnType<PrebookInPersonFlow['goToReviewPage']>>;
let commonLocators: CommonLocatorsHelper;
let scheduleOwnerTypeExpected = 'Location';
const REVIEW_PAGE_ID = 'REVIEW_PAGE';

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  flowClass = new PrebookInPersonFlow(page);
  locator = new Locators(page);
  commonLocators = new CommonLocatorsHelper(page);
  visitData = await flowClass.goToReviewPage();
  expect.soft(visitData.slotDetails).toBeDefined();
  const ownerType = visitData.slotDetails?.ownerType;
  if (ownerType === 'Practitioner') {
    scheduleOwnerTypeExpected = 'Provider';
  } else if (ownerType === 'HealthcareService') {
    scheduleOwnerTypeExpected = 'Group';
  }
});

test('Review and Submit Screen check data is correct', async () => {
  await test.step('Check title is visible', async () => {
    expect.soft(visitData.slotDetails).toBeDefined();
    await expect.soft(locator.flowHeading).toHaveText('Review and submit');
  });

  await test.step('Check description is visible', async () => {
    await expect.soft(locator.descReviewScreen).toBeVisible();
  });

  await test.step('Check patient title is visible', async () => {
    await expect.soft(locator.titlePatient).toBeVisible();
  });

  await test.step('Check location title is visible', async () => {
    await expect.soft(page.getByText(scheduleOwnerTypeExpected)).toBeVisible();
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
    expect.soft(visitData.slotDetails?.ownerName).toBeDefined();
    await commonLocators.checkLocationValueIsCorrect(visitData.slotDetails?.ownerName ?? null);
  });

  await test.step('Check privacy policy link', async () => {
    const privacyLinkDef = getPrivacyPolicyLinkDefForLocation(REVIEW_PAGE_ID);
    if (privacyLinkDef === undefined) {
      await expect(locator.privacyPolicyReviewScreen).not.toBeVisible();
      return;
    }
    const link = page.locator(`[data-testid="${privacyLinkDef.testId}"]`);
    await commonLocators.checkLinkOpensPdf(link);
  });

  await test.step('Check terms and conditions link', async () => {
    const termsLinkDef = getTermsAndConditionsLinkDefForLocation(REVIEW_PAGE_ID);
    if (termsLinkDef === undefined) {
      await expect(locator.termsAndConditions).not.toBeVisible();
      return;
    }
    const link = page.locator(`[data-testid="${termsLinkDef.testId}"]`);
    await commonLocators.checkLinkOpensPdf(link);
  });
});
