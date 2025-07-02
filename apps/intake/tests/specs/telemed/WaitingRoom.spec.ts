// cSpell:ignore WRMP
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { chooseJson, CreateAppointmentResponse } from 'utils';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { PaperworkTelemed } from '../../utils/telemed/Paperwork';
import { TelemedVisitFlow } from '../../utils/telemed/TelemedVisitFlow';

let page: Page;
let context: BrowserContext;
let flowClass: TelemedVisitFlow;
let paperwork: Paperwork;
let paperworkTelemed: PaperworkTelemed;
let locator: Locators;
let inviteeData: Awaited<ReturnType<PaperworkTelemed['fillInviteParticipant']>>;
const appointmentIds: string[] = [];

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  page.on('response', async (response) => {
    if (response.url().includes('/create-appointment/')) {
      const { appointmentId } = chooseJson(await response.json()) as CreateAppointmentResponse;
      if (!appointmentIds.includes(appointmentId)) {
        appointmentIds.push(appointmentId);
      }
    }
  });
  flowClass = new TelemedVisitFlow(page);
  paperwork = new Paperwork(page);
  paperworkTelemed = new PaperworkTelemed(page);
  locator = new Locators(page);
  await flowClass.startVisitFullFlow();
});

test.describe('Waiting room - Manage participants', () => {
  test.describe.configure({ mode: 'serial' });
  test('WRMP-1 Click on [Manage participant] when there are no invites', async () => {
    await locator.manageParticipant.click();
    await expect(locator.modalInviteParticipantTitle).toBeVisible();
  });
  test('WRMP-2 Invite participant - Check phone validations', async () => {
    await paperworkTelemed.fillInviteParticipant('phone', 'waiting-room');
    await paperwork.checkPhoneValidations(locator.wrInviteePhoneNumber);
  });
  test('WRMP-3 Invite participant - Check email validations', async () => {
    await paperworkTelemed.fillInviteParticipant('email', 'waiting-room');
    await paperwork.checkEmailValidations(locator.wrInviteeEmail);
  });
  test('WRMP-4 Invite participant by phone', async () => {
    inviteeData = await paperworkTelemed.fillInviteParticipant('phone', 'waiting-room');
    await locator.sendInvite.click();
    await paperwork.checkCorrectPageOpens('Waiting room');
    await expect(locator.inviteeList).toHaveText(
      `${inviteeData.inviteeName.inviteeFirstName} ${inviteeData.inviteeName.inviteeLastName}`
    );
  });
  test('WRMP-5 Click on [Manage participant] when there is invitee, check invitee data is correct', async () => {
    await locator.manageParticipant.click();
    await expect(locator.modalManageParticipantsTitle).toBeVisible();
    await expect(locator.wrInviteeName).toHaveText(
      `${inviteeData.inviteeName.inviteeFirstName} ${inviteeData.inviteeName.inviteeLastName}`
    );
    await expect(locator.wrInviteeContact).toHaveText(inviteeData.phone!);
  });
  test('WRMP-6 Click on [Cancel invite], cancel modal opens with correct invitee name', async () => {
    await locator.cancelInvite.click();
    await expect(
      page.getByText(
        `Are you sure you want to cancel invite for ${inviteeData.inviteeName.inviteeFirstName} ${inviteeData.inviteeName.inviteeLastName} for this visit?`
      )
    ).toBeVisible();
  });
  test('WRMP-7 Cancel invite modal - Click on [Keep invite]', async () => {
    await locator.keepInvite.click();
    await expect(
      page.getByText(
        `Are you sure you want to cancel invite for ${inviteeData.inviteeName.inviteeFirstName} ${inviteeData.inviteeName.inviteeLastName} for this visit?`
      )
    ).not.toBeVisible();
    await expect(locator.modalManageParticipantsTitle).toBeVisible();
  });
  test('WRMP-8 Cancel invite modal - Click on [Cancel invite]', async () => {
    await locator.cancelInvite.click();
    await expect(
      page.getByText(
        `Are you sure you want to cancel invite for ${inviteeData.inviteeName.inviteeFirstName} ${inviteeData.inviteeName.inviteeLastName} for this visit?`
      )
    ).toBeVisible();
    await locator.cancelInvite.click();
    await expect(locator.inviteeList).toHaveText('No invited participants');
  });
  test('WRMP-9 Invite participant by email', async () => {
    await locator.manageParticipant.click();
    await expect(locator.modalInviteParticipantTitle).toBeVisible();
    inviteeData = await paperworkTelemed.fillInviteParticipant('email', 'waiting-room');
    await locator.sendInvite.click();
    await paperwork.checkCorrectPageOpens('Waiting room');
    await expect(locator.inviteeList).toHaveText(
      `${inviteeData.inviteeName.inviteeFirstName} ${inviteeData.inviteeName.inviteeLastName}`
    );
  });
});
