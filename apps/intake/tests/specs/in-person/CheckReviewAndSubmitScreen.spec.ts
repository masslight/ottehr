import { test } from '@playwright/test';
import { ReviewPage } from '../../utils/ReviewPage';

test.describe.configure({ mode: 'parallel' });

test('RP-1 Check title is visible', async ({ page }) => {
  const reviewPage = new ReviewPage(page);
  await reviewPage.goToReviewPageInPersonVisit();
  await reviewPage.checkTitleIsVisible();
});
test('RP-2 Check description is visible', async ({ page }) => {
  const reviewPage = new ReviewPage(page);
  await reviewPage.goToReviewPageInPersonVisit();
  await reviewPage.checkDescIsVisible();
});
test('RP-3 Check patient title is visible', async ({ page }) => {
  const reviewPage = new ReviewPage(page);
  await reviewPage.goToReviewPageInPersonVisit();
  await reviewPage.checkPatientTitleIsVisible();
});
test('RP-4 Check location title is visible', async ({ page }) => {
  const reviewPage = new ReviewPage(page);
  await reviewPage.goToReviewPageInPersonVisit();
  await reviewPage.checkLocationTitleIsVisible();
});
test('RP-5 Check visit details title is visible', async ({ page }) => {
  const reviewPage = new ReviewPage(page);
  await reviewPage.goToReviewPageInPersonVisit();
  await reviewPage.checkVisitDetailsTitleIsVisible();
});
test('RP-6 Check location value is visible', async ({ page }) => {
  const reviewPage = new ReviewPage(page);
  await reviewPage.goToReviewPageInPersonVisit();
  await reviewPage.checkLocationValue();
});
test('RP-7 Check prebook slot value is visible', async ({ page }) => {
  const reviewPage = new ReviewPage(page);
  await reviewPage.goToReviewPageInPersonVisit();
  await reviewPage.checkPrebookSlotValue();
});
test('RP-8 Check patient name is correct', async ({ page }) => {
  const reviewPage = new ReviewPage(page);
  await reviewPage.checkPatientNameIsCorrect();
});
test('RP-9 Check slot is correct', async ({ page }) => {
  const reviewPage = new ReviewPage(page);
  await reviewPage.checkSlotIsCorrect();
});
test('RP-10 Check location value is correct', async ({ page }) => {
  const reviewPage = new ReviewPage(page);
  await reviewPage.checkLocationValueIsCorrect();
});
// TODO: currently link is opened like http instead of https. Need to check how it work on demo env
test.skip('RP-11 Check privacy policy link', async ({ page }) => {
  const reviewPage = new ReviewPage(page);
  await reviewPage.goToReviewPageInPersonVisit();
  await reviewPage.checkPrivacyPolicyLink();
});
// TODO: currently link is opened like http instead of https. Need to check how it work on demo env
test.skip('RP-12 Check terms and conditions link', async ({ page }) => {
  const reviewPage = new ReviewPage(page);
  await reviewPage.goToReviewPageInPersonVisit();
  await reviewPage.checkTermsAndConditionsLink();
});
