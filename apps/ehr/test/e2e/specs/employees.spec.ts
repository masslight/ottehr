import { expect, Page, test } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import {
  TEST_EMPLOYEE_1_UPDATED_INFO,
  TestEmployee,
  TestEmployeeInviteParams,
} from '../../e2e-utils/resource/employees';
import { AVAILABLE_EMPLOYEE_ROLES, RoleType } from '../../e2e-utils/temp-imports-from-utils';

// We may create new instances for the tests with mutable operations, and keep parralel tests isolated
const resourceHandler = new ResourceHandler();
const DEFAULT_TIMEOUT = { timeout: 15000 };

test.beforeAll(async () => {
  await resourceHandler.setEmployees();
});

test.afterAll(async () => {
  await resourceHandler.deleteEmployees();
});

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000); // ensure resources are ready
});

async function waitUntilEmployeeProviderTableLoaded(page: Page): Promise<void> {
  await expect(page.getByTestId(dataTestIds.employeesPage.table)).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId(dataTestIds.dashboard.loadingIndicator)).not.toBeVisible({ timeout: 15000 });
}

async function goToTestEmployeePage(page: Page, employee: TestEmployee): Promise<void> {
  await page.getByTestId(dataTestIds.employeesPage.searchByName).getByRole('textbox').fill(employee.givenName);
  const tbody = page.locator('tbody');
  const targetRow = tbody.locator(`tr:has-text("${employee.email}")`);
  const link = targetRow.locator('a');
  await link.click(DEFAULT_TIMEOUT);
  await expect(page.getByTestId(dataTestIds.employeesPage.informationForm)).toBeVisible(DEFAULT_TIMEOUT);
}

async function checkEmployeeFields(page: Page, employee: TestEmployeeInviteParams): Promise<void> {
  // CHECKING EMPLOYEE BASIC FIELDS
  const firstNameField = page.getByTestId(dataTestIds.employeesPage.firstName).locator('input');
  const middleNameField = page.getByTestId(dataTestIds.employeesPage.middleName).locator('input');
  const lastNameField = page.getByTestId(dataTestIds.employeesPage.lastName).locator('input');
  const emailField = page.getByTestId(dataTestIds.employeesPage.email).locator('input');
  const phoneField = page.getByTestId(dataTestIds.employeesPage.phone).locator('input');

  await expect(firstNameField).toHaveValue(employee.givenName);
  await expect(middleNameField).toHaveValue(employee.middleName);
  await expect(lastNameField).toHaveValue(employee.familyName);
  await expect(emailField).toHaveValue(employee.email!);
  await expect(phoneField).toHaveValue(employee.telecomPhone);

  // CHECKING EMPLOYEE ROLES
  for (const emp_role of AVAILABLE_EMPLOYEE_ROLES) {
    const roleCheckbox = page.getByTestId(dataTestIds.employeesPage.role(emp_role.value));
    if (employee.roles.includes(emp_role.value)) {
      await expect(roleCheckbox.getByRole('checkbox')).toBeChecked();
    } else {
      await expect(roleCheckbox.getByRole('checkbox')).not.toBeChecked();
    }
  }

  // IN CASE EMPLOYEE IS A PROVIDER WE CHECKING CREDENTIALS AND NPI
  if (employee.roles.includes(RoleType.Provider)) {
    const credentialsField = page.getByTestId(dataTestIds.employeesPage.providerDetailsCredentials).locator('input');
    await expect(credentialsField).toHaveValue(employee.credentials);

    const npiField = page.getByTestId(dataTestIds.employeesPage.providerDetailsNPI).locator('input');
    await expect(npiField).toHaveValue(employee.npi);
  }

  // CHECKING QUALIFICATION
  if (employee.qualification.length > 0) {
    const tbody = page.locator('tbody');
    const rows = tbody.locator('tr');
    await expect(rows).toHaveText(employee.qualification.map((q) => new RegExp(q.code)));
  }
}

async function updateEmployeesFields(page: Page, employee: TestEmployeeInviteParams): Promise<void> {
  // UPDATING EMPLOYEE BASIC FIELDS
  const firstNameField = page.getByTestId(dataTestIds.employeesPage.firstName).locator('input');
  const middleNameField = page.getByTestId(dataTestIds.employeesPage.middleName).locator('input');
  const lastNameField = page.getByTestId(dataTestIds.employeesPage.lastName).locator('input');
  const phoneField = page.getByTestId(dataTestIds.employeesPage.phone).locator('input');

  await firstNameField.fill(employee.givenName);
  await middleNameField.fill(employee.middleName);
  await lastNameField.fill(employee.familyName);
  await phoneField.fill(employee.telecomPhone);

  // UPDATING EMPLOYEE ROLES
  for (const emp_role of AVAILABLE_EMPLOYEE_ROLES) {
    const roleCheckbox = page.getByTestId(dataTestIds.employeesPage.role(emp_role.value));
    if (employee.roles.includes(emp_role.value)) await roleCheckbox.getByRole('checkbox').check();
    else await roleCheckbox.getByRole('checkbox').uncheck();
  }

  // IN CASE EMPLOYEE IS A PROVIDER WE UPDATING CREDENTIALS AND NPI
  if (employee.roles.includes(RoleType.Provider)) {
    const credentialsField = page.getByTestId(dataTestIds.employeesPage.providerDetailsCredentials).locator('input');
    await credentialsField.fill(employee.credentials);

    const npiField = page.getByTestId(dataTestIds.employeesPage.providerDetailsNPI).locator('input');
    await npiField.fill(employee.npi);
  }

  // DELETING ALL QUALIFICATIONS BEFORE POPULATING
  const rows = page.locator('table tbody tr');
  const rowCount = await rows.count();
  for (let i = 0; i < rowCount; i++) {
    const deleteButton = rows.nth(0).getByRole('button');
    await deleteButton.click(DEFAULT_TIMEOUT);
  }
  // ADDING ALL QUALIFICATIONS IN EMPLOYEE OBJ
  await page.getByTestId(dataTestIds.employeesPage.addQualificationAccordion).click(DEFAULT_TIMEOUT);
  const qualificationStateDropdown = page.getByTestId(dataTestIds.employeesPage.newQualificationStateDropdown);
  const qualificationTypeDropdown = page.getByTestId(dataTestIds.employeesPage.newQualificationTypeDropdown);
  const createQualificationButton = page.getByTestId(dataTestIds.employeesPage.addQualificationButton);
  for (const qualification of employee.qualification) {
    await qualificationStateDropdown.getByRole('button').click(DEFAULT_TIMEOUT);
    await qualificationStateDropdown.locator('input').fill(qualification.state);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await qualificationTypeDropdown.getByRole('button').click(DEFAULT_TIMEOUT);
    await qualificationTypeDropdown.locator('input').fill(qualification.code);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await createQualificationButton.click(DEFAULT_TIMEOUT);
  }
}

test('CSS ehr Employees page is working', async ({ page }) => {
  await page.goto(`employees`);
  await expect(page.getByTestId('PersonIcon')).toBeVisible();
  await expect(page.getByTestId(dataTestIds.header.userName)).toBeAttached(DEFAULT_TIMEOUT);

  await expect(page.getByTestId(dataTestIds.employeesPage.table)).toBeVisible(DEFAULT_TIMEOUT);
});

test('CSS ehr Employees list is loading', async ({ page }) => {
  await page.goto(`employees`);

  await waitUntilEmployeeProviderTableLoaded(page);
  const tbody = page.locator('tbody');
  const rows = tbody.locator('tr');

  await expect(rows).not.toHaveCount(0);
});

test('CSS ehr Providers tab on Employees page filters test', async ({ page }) => {
  await page.goto(`employees`);
  await page.locator(`[data-testid="${dataTestIds.employeesPage.providersTabButton}"]`).click(DEFAULT_TIMEOUT);
  await waitUntilEmployeeProviderTableLoaded(page);

  // WE SEARCHING FOR EMPLOYEES THAT CONTAINING 'ottehr-ehr-e2e' IN NAME
  await page
    .getByTestId(dataTestIds.employeesPage.searchByName)
    .getByRole('textbox')
    .fill(resourceHandler.testEmployee1.familyName);

  // SELECT 'AK' STATE BY CLICKING TWO TIMES DOWN IN STATES DROPDOWN
  await page.getByTestId(dataTestIds.employeesPage.providersStateFilter).getByRole('button', { name: 'Open' }).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  // CHECKING IF WE ARE RECEIVING OUR TEST EMPLOYEES
  await waitUntilEmployeeProviderTableLoaded(page);
  const rows = page.locator('tbody tr');
  const count = await rows.count();
  let allRowsText = '';
  for (let i = 0; i < count; i++) {
    const rowText = await rows.nth(i).innerText();
    allRowsText += rowText;
  }
  expect(allRowsText.includes(resourceHandler.testEmployee1.givenName)).toBe(true);
  expect(allRowsText.includes(resourceHandler.testEmployee2.givenName)).toBe(true);
});

test('CSS ehr Employees editing user, and checking all fields are correct displayed', async ({ page }) => {
  await page.goto(`employees`);
  await waitUntilEmployeeProviderTableLoaded(page);
  await goToTestEmployeePage(page, resourceHandler.testEmployee1);

  // UPDATING EMPLOYEE DATA
  await updateEmployeesFields(page, TEST_EMPLOYEE_1_UPDATED_INFO);

  const submitButton = page.getByTestId(dataTestIds.employeesPage.submitButton);
  await submitButton.click(DEFAULT_TIMEOUT);

  // WAIT FOR SNACKBAR TO BE VISIBLE
  await expect(page.locator('div[id=notistack-snackbar]')).toBeVisible(DEFAULT_TIMEOUT);
  await expect(submitButton).not.toBeDisabled(DEFAULT_TIMEOUT);

  // CHECKING IF ALL FIELDS WERE UPDATED
  await page.reload(DEFAULT_TIMEOUT);
  // we do that because email is not changing, and email has unique uuid, so we can't know what will be there
  TEST_EMPLOYEE_1_UPDATED_INFO.email = resourceHandler.testEmployee1.email;
  await checkEmployeeFields(page, TEST_EMPLOYEE_1_UPDATED_INFO);

  // RETURN PROVIDER DATA TO INITIAL VALUES
  await updateEmployeesFields(page, resourceHandler.testEmployee1);

  await submitButton.click(DEFAULT_TIMEOUT);
  await expect(submitButton).not.toBeDisabled(DEFAULT_TIMEOUT);

  // CHECKING IF ALL FIELDS WERE RETURNED TO INITIAL
  await page.reload(DEFAULT_TIMEOUT);
  await checkEmployeeFields(page, resourceHandler.testEmployee1);
});

test('CSS ehr activate/deactivate employee test', async ({ page }) => {
  await page.goto(`employees`);
  await waitUntilEmployeeProviderTableLoaded(page);
  await page
    .getByTestId(dataTestIds.employeesPage.searchByName)
    .getByRole('textbox')
    .fill(resourceHandler.testEmployee2.givenName);
  const tbody = page.locator('tbody');
  const targetRow = tbody.locator(`tr:has-text("${resourceHandler.testEmployee2.email}")`);
  const status = await targetRow.getByTestId(dataTestIds.employeesPage.statusChip).textContent();

  if (status !== 'DEACTIVATED') {
    await goToTestEmployeePage(page, resourceHandler.testEmployee2);
    await expect(page.getByTestId(dataTestIds.employeesPage.deactivateUserButton)).toBeVisible(DEFAULT_TIMEOUT);
    await page.getByTestId(dataTestIds.employeesPage.deactivateUserButton).click(DEFAULT_TIMEOUT);
    // WAIT FOR SNACKBAR TO BE VISIBLE
    await expect(page.locator('div[id=notistack-snackbar]')).toBeVisible(DEFAULT_TIMEOUT);

    await page.goto(`employees`);
    await waitUntilEmployeeProviderTableLoaded(page);
    await page
      .getByTestId(dataTestIds.employeesPage.searchByName)
      .getByRole('textbox')
      .fill(resourceHandler.testEmployee2.givenName);
    const tbody = page.locator('tbody');
    const targetRow = tbody.locator(`tr:has-text("${resourceHandler.testEmployee2.email}")`);
    await expect(targetRow.getByTestId(dataTestIds.employeesPage.statusChip)).toHaveText('DEACTIVATED');
  }
});
