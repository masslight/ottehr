import { test } from '@playwright/test';
import { expectStateDetailsPage } from '../page/VirtualLocationDetailsPage';
import { expectVirtualLocationsPage, openVirtualLocationsPage } from '../page/VirtualLocationsPage';

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000); // TODO what is this actually waiting for? Replace it with something faster.
  await page.goto('/telemed-admin/virtual-locations');
});

test('Open "Virtual Locations page", enter state abbreviation,  correct search result is displayed', async ({
  page,
}) => {
  const virtualLocationsPage = await expectVirtualLocationsPage(page);
  const state = await virtualLocationsPage.getFirstLocation();
  await virtualLocationsPage.searchStates(state.name);
  await virtualLocationsPage.verifyLocationPresent(state.id);
  await virtualLocationsPage.verifyPaginationState('1–1 of 1');

  await virtualLocationsPage.searchStates('AA');
  await virtualLocationsPage.verifyPaginationState('0–0 of 0');
});

test('Open "Virtual Locations page", click on state, virtual locations details page is opened', async ({ page }) => {
  const virtualLocationsPage = await expectVirtualLocationsPage(page);
  const state = await virtualLocationsPage.getFirstLocation();
  await virtualLocationsPage.clickLocation(state.id);
  await expectStateDetailsPage(state.id, state.name, page);
});

test('Open "Virtual Locations details page", click cancel button,  virtual locations page is opened', async ({
  page,
}) => {
  const virtualLocationsPage = await expectVirtualLocationsPage(page);
  const location = await virtualLocationsPage.getFirstLocation();
  await virtualLocationsPage.clickLocation(location.id);
  const stateDetailsPage = await expectStateDetailsPage(location.id, location.name, page);
  await stateDetailsPage.clickCancelButton();
  await expectVirtualLocationsPage(page);
});

test('Open "Virtual Locations details page", check title and state name field,  verify state name is correct in title', async ({
  page,
}) => {
  const virtualLocationsPage = await expectVirtualLocationsPage(page);
  const location = await virtualLocationsPage.getFirstLocation();
  await virtualLocationsPage.clickLocation(location.id);
  const stateDetailsPage = await expectStateDetailsPage(location.id, location.name, page);
  await stateDetailsPage.verifyLocationNameTitle(location.name);
  await stateDetailsPage.verifyLocationNameField(location.name);
});

test('Open "Virtual Locations details page", toggle "Active" and save changes, verify changes are saved', async ({
  page,
}) => {
  let virtualLocationsPage = await expectVirtualLocationsPage(page);
  const location = await virtualLocationsPage.getFirstLocation();
  await virtualLocationsPage.clickLocation(location.id);
  const stateDetailsPage = await expectStateDetailsPage(location.id, location.name, page);

  if (await stateDetailsPage.isToggleOn()) {
    await stateDetailsPage.setToggleOff();
    await stateDetailsPage.clickSaveChangesButton();
    await stateDetailsPage.reloadStateDetailsPage();
    await stateDetailsPage.verifyToggleOff();
    virtualLocationsPage = await openVirtualLocationsPage(page);
    await virtualLocationsPage.verifyActive(location.id, false);
  } else {
    await stateDetailsPage.setToggleOn();
    await stateDetailsPage.clickSaveChangesButton();
    await stateDetailsPage.reloadStateDetailsPage();
    await stateDetailsPage.verifyToggleOn();
    virtualLocationsPage = await openVirtualLocationsPage(page);
    await virtualLocationsPage.verifyActive(location.id, true);
  }
});
