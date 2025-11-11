import { BrowserContext, Page, test } from '@playwright/test';
import { expectStateDetailsPage, VirtualLocationDetailsPage } from '../page/VirtualLocationDetailsPage';
import {
  expectVirtualLocationsPage,
  openVirtualLocationsPage,
  VirtualLocationsPage,
} from '../page/VirtualLocationsPage';

let page: Page;
let context: BrowserContext;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await page.goto('/telemed-admin/virtual-locations');
});

test.afterAll(async () => {
  await page.close();
  await context.close();
});

let firstState: { id: string; name: string };
let virtualLocationsPage: VirtualLocationsPage;
let stateDetailsPage: VirtualLocationDetailsPage;

test.describe.configure({ mode: 'serial' });

test('Open "Virtual Locations page", enter state abbreviation,  correct search result is displayed', async () => {
  virtualLocationsPage = await expectVirtualLocationsPage(page);
  firstState = await virtualLocationsPage.getFirstLocation();
  await virtualLocationsPage.searchStates(firstState.name);
  await virtualLocationsPage.verifyLocationPresent(firstState.id);
  await virtualLocationsPage.verifyPaginationState('1–1 of 1');

  await virtualLocationsPage.searchStates('AA');
  await virtualLocationsPage.verifyPaginationState('0–0 of 0');
});

test('Сlick on state, virtual locations details page is opened', async () => {
  await virtualLocationsPage.searchStates(firstState.name);
  await virtualLocationsPage.clickLocation(firstState.id);
  stateDetailsPage = await expectStateDetailsPage(firstState.id, firstState.name, page);
});

test('Сlick cancel button, virtual locations page is opened', async () => {
  await stateDetailsPage.clickCancelButton();
  await expectVirtualLocationsPage(page);
});

test('Open "Virtual Locations details page", check title and state name field, verify state name is correct in title', async () => {
  await virtualLocationsPage.clickLocation(firstState.id);
  const stateDetailsPage = await expectStateDetailsPage(firstState.id, firstState.name, page);
  await stateDetailsPage.verifyLocationNameTitle(firstState.name);
  await stateDetailsPage.verifyLocationNameField(firstState.name);
});

test('Open "Virtual Locations details page", toggle "Active" and save changes, verify changes are saved', async () => {
  if (await stateDetailsPage.isToggleOn()) {
    await stateDetailsPage.setToggleOff();
    await stateDetailsPage.clickSaveChangesButton();
    await stateDetailsPage.reloadStateDetailsPage();
    await stateDetailsPage.verifyToggleOff();
    virtualLocationsPage = await openVirtualLocationsPage(page);
    await virtualLocationsPage.verifyActive(firstState.id, false);
  } else {
    await stateDetailsPage.setToggleOn();
    await stateDetailsPage.clickSaveChangesButton();
    await stateDetailsPage.reloadStateDetailsPage();
    await stateDetailsPage.verifyToggleOn();
    virtualLocationsPage = await openVirtualLocationsPage(page);
    await virtualLocationsPage.verifyActive(firstState.id, true);
  }
});
