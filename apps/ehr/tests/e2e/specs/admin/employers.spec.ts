import Oystehr from '@oystehr/sdk';
import { BrowserContext, Page, test } from '@playwright/test';
import { Organization } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { EmployerDialogPage, EmployersPage, expectEmployersPage } from '../../page/EmployersPage';

const PROCESS_ID = `employers-admin-${DateTime.now().toMillis()}`;
const EMPLOYER_NAME = `E2E Employer ${PROCESS_ID}`;
const EMPLOYER_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/organization-type';
const EMPLOYER_TYPE_CODE = 'occupational-medicine-employer';

let oystehr: Oystehr;
let page: Page;
let context: BrowserContext;
let employersPage: EmployersPage;
let dialog: EmployerDialogPage;

async function cleanupCreatedEmployers(): Promise<void> {
  const search = await oystehr.fhir.search<Organization>({
    resourceType: 'Organization',
    params: [
      { name: 'name', value: EMPLOYER_NAME },
      { name: 'type', value: `${EMPLOYER_TYPE_SYSTEM}|${EMPLOYER_TYPE_CODE}` },
    ],
  });

  const employers = search.unbundle().filter((org) => org.name === EMPLOYER_NAME);
  for (const employer of employers) {
    if (!employer.id) continue;
    await oystehr.fhir.delete({ resourceType: 'Organization', id: employer.id }).catch((err) => {
      console.warn(`Failed to delete employer ${employer.id} during cleanup`, err);
    });
  }
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  oystehr = await ResourceHandler.getOystehr();
  await cleanupCreatedEmployers();
  context = await browser.newContext();
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.close();
  await context.close();
  await cleanupCreatedEmployers();
});

test.describe('Billing Employers Admin', () => {
  test('open Employers tab and verify table loads', async () => {
    await page.goto('/admin/billing/employers');
    employersPage = await expectEmployersPage(page);
    await employersPage.verifyEmployersTabSelected();
  });

  test('create employer from Add New dialog', async () => {
    dialog = await employersPage.clickAddNew();
    await dialog.fillEmployerName(EMPLOYER_NAME);
    await dialog.clickAdd();
    await dialog.expectSnackbar(/created successfully|saved, but candid sync failed/i);
  });

  test('search filters employers and finds new employer', async () => {
    await employersPage.searchEmployers(EMPLOYER_NAME);
    await employersPage.verifyEmployerVisible(EMPLOYER_NAME);
  });

  test('search for nonexistent employer shows no results', async () => {
    await employersPage.searchEmployers('ZZZZNONEXISTENT');
    await employersPage.verifyEmployerNotVisible(EMPLOYER_NAME);
    await employersPage.searchEmployers('');
  });

  test('click employer row opens detail dialog', async () => {
    await employersPage.searchEmployers(EMPLOYER_NAME);
    dialog = await employersPage.clickEmployerByName(EMPLOYER_NAME);
    await dialog.verifyTitle('Employer Details');
  });

  test('deactivate employer from detail dialog', async () => {
    await dialog.clickDeactivate();
    await dialog.expectSnackbar(/deactivated/i);
    await dialog.verifyStatusChip('INACTIVE');
  });

  test('activate employer from detail dialog', async () => {
    await dialog.clickActivate();
    await dialog.expectSnackbar(/activated/i);
    await dialog.verifyStatusChip('ACTIVE');
  });

  test('close dialog returns to employers table', async () => {
    await dialog.clickDone();
    await dialog.waitForClosed();
    await employersPage.verifyEmployerVisible(EMPLOYER_NAME);
  });
});
