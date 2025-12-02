import { expect, Page, test } from '@playwright/test';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Locators } from '../../utils/locators';

let page: Page;
let flowClass: PrebookInPersonFlow;
let locator: Locators;
let visitData: Awaited<ReturnType<PrebookInPersonFlow['goToReviewPage']>>;
let commonLocators: CommonLocatorsHelper;
let scheduleOwnerTypeExpected = 'Location';

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

test('RS. Reservation Screen check data is correct', async () => {
  await test.step('RS-1. Check titles and description', async () => {
    expect.soft(visitData.slotDetails).toBeDefined();
    await expect.soft(locator.flowHeading).toHaveText('Review and submit');
    await expect.soft(locator.descReviewScreen).toBeVisible();
    await expect.soft(locator.titleVisitDetails).toBeVisible();
  });

  await test.step('RS-2. Check patient details', async () => {
    await expect.soft(locator.titlePatient).toBeVisible();
    const firstName = visitData.firstName;
    const lastName = visitData.lastName;
    await commonLocators.checkPatientNameIsCorrect({ firstName, lastName });
  });

  await test.step('RS-3. Check location details', async () => {
    await expect.soft(page.getByText(scheduleOwnerTypeExpected)).toBeVisible();
    await flowClass.checkValueIsNotEmpty(locator.locationName);
    await expect.soft(locator.locationName).toBeVisible();
    expect.soft(visitData.slotDetails?.ownerName).toBeDefined();
    await commonLocators.checkLocationValueIsCorrect(visitData.slotDetails?.ownerName ?? null);
  });

  await test.step('RS-4. Check slot details', async () => {
    await flowClass.checkValueIsNotEmpty(locator.prebookSlotReviewScreen);
    await expect.soft(locator.prebookSlotReviewScreen).toBeVisible();
    await commonLocators.checkSlotIsCorrect(visitData.selectedSlot?.selectedSlot);
  });

  await test.step('RS-5. Check links', async () => {
    await commonLocators.checkLinkOpensPdf(locator.privacyPolicyReviewScreen);
    await commonLocators.checkLinkOpensPdf(locator.termsAndConditions);
  });
});
