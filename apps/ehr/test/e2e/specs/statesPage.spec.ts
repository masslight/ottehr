import { test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { expectStatesPage, openStatesPage } from '../page/StatesPage';
import { expectStateDetailsPage } from '../page/StateDetailsPage';
const resourceHandler = new ResourceHandler();

const STATES_1_10 = [
  'AL - Alabama',
  'AK - Alaska',
  'AZ - Arizona',
  'AR - Arkansas',
  'CA - California',
  'CO - Colorado',
  'CT - Connecticut',
  'DE - Delaware',
  'DC - District of Columbia',
  'FL - Florida',
];

const STATES_11_20 = [
  'GA - Georgia',
  'HI - Hawaii',
  'ID - Idaho',
  'IL - Illinois',
  'IN - Indiana',
  'IA - Iowa',
  'KS - Kansas',
  'KY - Kentucky',
  'LA - Louisiana',
  'ME - Maine',
];

const STATES_21_30 = [
  'MD - Maryland',
  'MA - Massachusetts',
  'MI - Michigan',
  'MN - Minnesota',
  'MS - Mississippi',
  'MO - Missouri',
  'MT - Montana',
  'NE - Nebraska',
  'NV - Nevada',
  'NH - New Hampshire',
];

const STATES_31_40 = [
  'NJ - New Jersey',
  'NM - New Mexico',
  'NY - New York',
  'NC - North Carolina',
  'ND - North Dakota',
  'OH - Ohio',
  'OK - Oklahoma',
  'OR - Oregon',
  'PA - Pennsylvania',
  'RI - Rhode Island',
];

const STATES_41_50 = [
  'SC - South Carolina',
  'SD - South Dakota',
  'TN - Tennessee',
  'TX - Texas',
  'UT - Utah',
  'VT - Vermont',
  'VA - Virginia',
  'VI - Virgin Islands',
  'WA - Washington',
  'WV - West Virginia',
];
const STATES_51_52 = ['WI - Wisconsin', 'WY - Wyoming'];
const STATE_NAME = 'CO - Colorado';

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000);
  await page.goto('/telemed-admin/states');
});

test('Open "States page", click through all pages forward and backward,  pages contains correct states', async ({
  page,
}) => {
  const statesPage = await expectStatesPage(page);
  await statesPage.verifyPaginationState('1–10 of 52');
  await statesPage.verifyStatesPresent(STATES_1_10);
  await statesPage.clickNextPage();
  await statesPage.verifyPaginationState('11–20 of 52');
  await statesPage.verifyStatesPresent(STATES_11_20);
  await statesPage.clickNextPage();
  await statesPage.verifyPaginationState('21–30 of 52');
  await statesPage.verifyStatesPresent(STATES_21_30);
  await statesPage.clickNextPage();
  await statesPage.verifyPaginationState('31–40 of 52');
  await statesPage.verifyStatesPresent(STATES_31_40);
  await statesPage.clickNextPage();
  await statesPage.verifyPaginationState('41–50 of 52');
  await statesPage.verifyStatesPresent(STATES_41_50);
  await statesPage.clickNextPage();
  await statesPage.verifyPaginationState('51–52 of 52');
  await statesPage.verifyStatesPresent(STATES_51_52);
  await statesPage.clickPreviousPage();
  await statesPage.verifyPaginationState('41–50 of 52');
  await statesPage.verifyStatesPresent(STATES_41_50);
  await statesPage.clickPreviousPage();
  await statesPage.verifyPaginationState('31–40 of 52');
  await statesPage.verifyStatesPresent(STATES_31_40);
  await statesPage.clickPreviousPage();
  await statesPage.verifyPaginationState('21–30 of 52');
  await statesPage.verifyStatesPresent(STATES_21_30);
  await statesPage.clickPreviousPage();
  await statesPage.verifyPaginationState('11–20 of 52');
  await statesPage.verifyStatesPresent(STATES_11_20);
  await statesPage.clickPreviousPage();
  await statesPage.verifyPaginationState('1–10 of 52');
  await statesPage.verifyStatesPresent(STATES_1_10);
});

test('Open "States page", select 100 rows per page,  all states are displayed', async ({ page }) => {
  const statesPage = await expectStatesPage(page);
  await statesPage.selectRowsPerPage('100');
  await statesPage.verifyStatesPresent(STATES_1_10);
  await statesPage.verifyStatesPresent(STATES_21_30);
  await statesPage.verifyStatesPresent(STATES_31_40);
  await statesPage.verifyStatesPresent(STATES_41_50);
  await statesPage.verifyStatesPresent(STATES_51_52);
});

test('Open "States page", enter state abbreviation,  correct search result is displayed', async ({ page }) => {
  const statesPage = await expectStatesPage(page);
  await statesPage.searchStates('ID');
  await statesPage.verifyStatesPresent(['ID - Idaho']);
  await statesPage.verifyPaginationState('1–1 of 1');

  await statesPage.searchStates('ca');
  await statesPage.verifyStatesPresent(['CA - California']);
  await statesPage.verifyPaginationState('1–1 of 1');

  await statesPage.searchStates('AA');
  await statesPage.verifyPaginationState('0–0 of 0');
});

test('Open "States page", click on state,  state details page is opened', async ({ page }) => {
  const statesPage = await expectStatesPage(page);
  await statesPage.clickState(STATE_NAME);
  await expectStateDetailsPage('CO', page);
});

test('Open "States details page", click cancel button,  states page is opened', async ({ page }) => {
  const statesPage = await expectStatesPage(page);
  await statesPage.clickState(STATE_NAME);
  const stateDetailsPage = await expectStateDetailsPage('CO', page);
  await stateDetailsPage.clickCancelButton();
  await expectStatesPage(page);
});

test('Open "States details page", check title and state name field,  verify state name is correct in title', async ({
  page,
}) => {
  const statesPage = await expectStatesPage(page);
  await statesPage.clickState(STATE_NAME);
  const stateDetailsPage = await expectStateDetailsPage('CO', page);
  await stateDetailsPage.verifyStateNameTitle('CO - Telemed Colorado');
  await stateDetailsPage.verifyStateNameField('CO - Telemed Colorado');
});

test('Open "States details page", toggle "Operate in state" and save changes, verify changes are saved', async ({
  page,
}) => {
  let statesPage = await expectStatesPage(page);
  await statesPage.clickState(STATE_NAME);
  const stateDetailsPage = await expectStateDetailsPage('CO', page);

  if (await stateDetailsPage.isToggleOn()) {
    await stateDetailsPage.setToggleOff();
    await stateDetailsPage.clickSaveChangesButton();
    await stateDetailsPage.reloadStateDetailsPage();
    await stateDetailsPage.verifyToggleOff();
    statesPage = await openStatesPage(page);
    await statesPage.verifyOperateInState('CO', false);
  } else {
    await stateDetailsPage.setToggleOn();
    await stateDetailsPage.clickSaveChangesButton();
    await stateDetailsPage.reloadStateDetailsPage();
    await stateDetailsPage.verifyToggleOn();
    statesPage = await openStatesPage(page);
    await statesPage.verifyOperateInState('CO', true);
  }
});
