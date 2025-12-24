// cSpell:ignore WRMP
import { BrowserContext, expect, Page, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { PaperworkTelemed } from '../../utils/telemed/Paperwork';
import { TelemedWaitingRoomPatient } from '../0_paperworkSetup/types';

let page: Page;
let context: BrowserContext;
let paperwork: Paperwork;
let paperworkTelemed: PaperworkTelemed;
let locator: Locators;
let inviteeData: Awaited<ReturnType<PaperworkTelemed['fillInviteParticipant']>>;
let inviteeFullName: string;
let patient: TelemedWaitingRoomPatient;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  paperwork = new Paperwork(page);
  paperworkTelemed = new PaperworkTelemed(page);
  locator = new Locators(page);

  const testDataPath = path.join('test-data', 'telemedWaitingRoomPatient.json');
  patient = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe('Telemed - WRMP. Prefilled Paperwork, Waiting Room', () => {
  test('WRMP-1. Open waiting room page directly', async () => {
    await page.goto(`waiting-room?appointment_id=${patient.appointmentId}`);
    await paperwork.checkCorrectPageOpens('Waiting room');
  });

  test('WRMP-2. Invite participant', async () => {
    await test.step('WRMP-2.1. Click on [Manage participant] when there are no invitees', async () => {
      await locator.manageParticipant.click();
      await expect(locator.modalInviteParticipantTitle).toBeVisible();
    });

    await test.step('WRMP-2.2. Check phone validations', async () => {
      await paperworkTelemed.fillInviteParticipant('phone', 'waiting-room');
      await paperwork.checkPhoneValidations(locator.wrInviteePhoneNumber);
    });

    await test.step('WRMP-2.3. Check email validations', async () => {
      await paperworkTelemed.fillInviteParticipant('email', 'waiting-room');
      await paperwork.checkEmailValidations(locator.wrInviteeEmail);
    });

    await test.step('WRMP-2.4. Invite participant by phone', async () => {
      inviteeData = await paperworkTelemed.fillInviteParticipant('phone', 'waiting-room');
      inviteeFullName = `${inviteeData.inviteeName.inviteeFirstName} ${inviteeData.inviteeName.inviteeLastName}`;
      await locator.sendInvite.click();
      await paperwork.checkCorrectPageOpens('Waiting room');
      await expect(locator.inviteeList).toHaveText(inviteeFullName);
    });
  });

  test('WRMP-3. Cancel participant', async () => {
    await test.step('WRMP-3.1. Click on [Cancel invite], cancel modal opens with correct invitee name', async () => {
      await page.getByRole('button', { name: `Manage participants ${inviteeFullName}` }).click();
      await locator.cancelInvite.click();
      await expect(
        page.getByText(`Are you sure you want to cancel invite for ${inviteeFullName} for this visit?`)
      ).toBeVisible();
    });

    await test.step('WRMP-3.2. Click on [Keep invite], modal closes, invitee remains in the list', async () => {
      await locator.keepInvite.click();
      await expect(
        page.getByText(`Are you sure you want to cancel invite for ${inviteeFullName} for this visit?`)
      ).not.toBeVisible();
      await expect(locator.modalManageParticipantsTitle).toBeVisible();
    });

    await test.step('WRMP-3.3. Cancel invite successfully', async () => {
      await locator.cancelInvite.click();
      await expect(
        page.getByText(`Are you sure you want to cancel invite for ${inviteeFullName} for this visit?`)
      ).toBeVisible();
      await locator.cancelInvite.click();
      await expect(locator.inviteeList).toHaveText('No invited participants');
    });
  });

  test('WRMP-4. Invite participant by email', async () => {
    await locator.manageParticipant.click();
    await expect(locator.modalInviteParticipantTitle).toBeVisible();
    inviteeData = await paperworkTelemed.fillInviteParticipant('email', 'waiting-room');
    await locator.sendInvite.click();
    await paperwork.checkCorrectPageOpens('Waiting room');
    await expect(locator.inviteeList).toHaveText(inviteeFullName);
  });
});
