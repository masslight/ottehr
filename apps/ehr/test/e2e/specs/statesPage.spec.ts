import { test } from '@playwright/test';
import { expectStateDetailsPage } from '../page/StateDetailsPage';
import { expectStatesPage, openStatesPage } from '../page/StatesPage';

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000);
  await page.goto('/telemed-admin/states');
});

test('Open "States page", enter state abbreviation,  correct search result is displayed', async ({ page }) => {
  const statesPage = await expectStatesPage(page);
  const state = await statesPage.getFisrtState();
  await statesPage.searchStates(state);
  await statesPage.verifyStatePresent(state);
  await statesPage.verifyPaginationState('1–1 of 1');

  await statesPage.searchStates('AA');
  await statesPage.verifyPaginationState('0–0 of 0');
});

test('Open "States page", click on state,  state details page is opened', async ({ page }) => {
  const statesPage = await expectStatesPage(page);
  const state = await statesPage.getFisrtState();
  await statesPage.clickState(state);
  await expectStateDetailsPage(state, page);
});

test('Open "States details page", click cancel button,  states page is opened', async ({ page }) => {
  const statesPage = await expectStatesPage(page);
  const state = await statesPage.getFisrtState();
  await statesPage.clickState(state);
  const stateDetailsPage = await expectStateDetailsPage(state, page);
  await stateDetailsPage.clickCancelButton();
  await expectStatesPage(page);
});

test('Open "States details page", check title and state name field,  verify state name is correct in title', async ({
  page,
}) => {
  const statesPage = await expectStatesPage(page);
  const state = await statesPage.getFisrtState();
  await statesPage.clickState(state);
  const stateDetailsPage = await expectStateDetailsPage(state, page);
  await stateDetailsPage.verifyStateNameTitle(state);
  await stateDetailsPage.verifyStateNameField(state);
});

test('Open "States details page", toggle "Operate in state" and save changes, verify changes are saved', async ({
  page,
}) => {
  let statesPage = await expectStatesPage(page);
  const state = await statesPage.getFisrtState();
  await statesPage.clickState(state);
  const stateDetailsPage = await expectStateDetailsPage(state, page);

  if (await stateDetailsPage.isToggleOn()) {
    await stateDetailsPage.setToggleOff();
    await stateDetailsPage.clickSaveChangesButton();
    await stateDetailsPage.reloadStateDetailsPage();
    await stateDetailsPage.verifyToggleOff();
    statesPage = await openStatesPage(page);
    await statesPage.verifyOperateInState(state, false);
  } else {
    await stateDetailsPage.setToggleOn();
    await stateDetailsPage.clickSaveChangesButton();
    await stateDetailsPage.reloadStateDetailsPage();
    await stateDetailsPage.verifyToggleOn();
    statesPage = await openStatesPage(page);
    await statesPage.verifyOperateInState(state, true);
  }
});
