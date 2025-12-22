import { BrowserContext, Page, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { CancelPage } from '../../utils/CancelPage';
import { ModifyPage } from '../../utils/ModifyPage';
import { ReservationModificationPatient } from '../0_paperworkSetup/types';

let page: Page;
let context: BrowserContext;
let patient: ReservationModificationPatient;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();

  const testDataPath = path.join('test-data', 'inPersonReservationModificationPatient.json');
  patient = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
});

test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe.configure({ mode: 'serial' });

test('Modify and Cancel flow', async () => {
  await page.goto(`/visit/${patient.appointmentId}`);
});

test('MV-1. Click on [Modify] - Modify screen opens', async () => {
  const modifyPage = new ModifyPage(page);
  await modifyPage.checkModifyPageOpens();
});
test('MV-2. Update time slot', async () => {
  const modifyPage = new ModifyPage(page);
  await modifyPage.selectNewTimeSlot();
  await modifyPage.checkTimeSlotIsUpdated();
});
test('CV-1. Click on [Cancel] - Cancel screen opens', async () => {
  const cancelPage = new CancelPage(page);
  await page.goto(`/visit/${patient.appointmentId}` || '/');
  await cancelPage.checkCancelPageOpens();
});
test('CV-2. Select cancellation reason', async () => {
  const cancelPage = new CancelPage(page);
  await cancelPage.selectCancellationReason('in-person');
});
test('CV-3. Visit is canceled', async () => {
  const cancelPage = new CancelPage(page);
  await cancelPage.checkVisitIsCanceled();
});
test('CV-4. Click on [Book again] - Home page opens', async () => {
  const cancelPage = new CancelPage(page);
  await cancelPage.checkBookAgainOpensHomePage();
});
