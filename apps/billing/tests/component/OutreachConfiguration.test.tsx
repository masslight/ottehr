import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DEFAULT_EMAIL_TEMPLATE,
  DEFAULT_SMS_TEMPLATE,
  defaultNotificationConfig,
} from 'utils/lib/helpers/rcm/scheduled-outreach-config';
import { OutreachAction, OutreachConfigResponse } from 'utils/lib/types/api/scheduled-outreach.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OutreachConfiguration from '../../src/pages/OutreachConfiguration';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  snackbar: vi.fn(),
  client: {},
  flags: { mailingPaperStatementsEnabled: true, automatedPatientOutreachEnabled: true },
}));
vi.mock('../../src/api/api', () => ({ getOutreachConfig: mocks.get, saveOutreachConfig: mocks.save }));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: mocks.client }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: mocks.snackbar }));
vi.mock('utils/lib/ottehr-config/feature-flags', () => ({ FEATURE_FLAGS_CONFIG: mocks.flags }));

const reminder: OutreachAction = {
  id: 'reminder-id',
  trigger: { event: 'invoice-issued', daysAfter: 3 },
  actionType: 'send-notification',
  sendNotificationConfig: { mediums: ['sms'], smsTemplate: 'Pay {{amount}}', emailTemplate: '' },
};
const collections: OutreachAction = {
  id: 'collections-id',
  enabled: false,
  trigger: { event: 'invoice-due', daysAfter: 30, timeUnit: 'days' },
  actionType: 'refer-to-collections',
  referToCollectionsConfig: { agency: 'IC System', minimumBalance: 50, includePaymentHistory: true },
};
const restriction = { enabled: true, windowStart: '09:00', windowEnd: '18:00', timezone: 'America/Chicago' };

function config(actions: OutreachAction[] = [reminder, collections]): OutreachConfigResponse {
  return {
    planDefinition: { resourceType: 'PlanDefinition', status: 'active' },
    actions,
    notificationsTimeRestriction: restriction,
  };
}

const saveButton = (): HTMLElement => screen.getByRole('button', { name: 'Save changes' });
const section = (label: string): ReturnType<typeof within> =>
  within(screen.getByRole('region', { name: `Triggered by ${label}` }));

describe('Outreach Configuration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.client = {};
    mocks.get.mockResolvedValue(config());
    mocks.save.mockImplementation((_client, body: { actions: OutreachAction[] }) =>
      Promise.resolve(config(body.actions))
    );
  });

  it('shows saved actions under their trigger event and keeps Save disabled until an edit', async () => {
    const user = userEvent.setup();
    render(<OutreachConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    expect(section('Invoice Issue Date').getByRole('group', { name: 'Send Notification action' })).toBeVisible();
    expect(section('Invoice Issue Date').getByRole('textbox', { name: 'SMS Template' })).toHaveValue('Pay {{amount}}');
    expect(
      section('Invoice Due Date').getByText('Automated referral to collections action is not yet available.')
    ).toBeVisible();
    expect(saveButton()).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'SMS Template' }), '!');
    expect(saveButton()).toBeEnabled();
  });

  it('sends every action back with ids and unshown fields untouched', async () => {
    const user = userEvent.setup();
    render(<OutreachConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    await user.type(screen.getByRole('textbox', { name: 'SMS Template' }), '!');
    await user.click(saveButton());
    expect(mocks.save).toHaveBeenCalledWith(mocks.client, {
      actions: [
        { ...reminder, sendNotificationConfig: { ...reminder.sendNotificationConfig, smsTemplate: 'Pay {{amount}}!' } },
        collections,
      ],
      notificationsTimeRestriction: restriction,
    });
    expect(mocks.snackbar).toHaveBeenCalledWith('Outreach settings saved', { variant: 'success' });
    expect(saveButton()).toBeDisabled();
  });

  it('adds a default send-notification action under Invoice Due Date limited to invoice events', async () => {
    const user = userEvent.setup();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
    render(<OutreachConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    await user.click(section('Invoice Due Date').getByRole('button', { name: 'Add action' }));
    const added = section('Invoice Due Date').getByRole('group', { name: 'Send Notification action' });
    await user.click(within(added).getByRole('combobox', { name: 'Trigger Event' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Invoice Issue Date',
      'Invoice Due Date',
    ]);
    await user.keyboard('{Escape}');
    await user.click(saveButton());
    expect(mocks.save.mock.calls[0][1].actions).toEqual([
      reminder,
      collections,
      {
        id: '00000000-0000-4000-8000-000000000000',
        trigger: { event: 'invoice-due', daysAfter: 0 },
        actionType: 'send-notification',
        sendNotificationConfig: {
          mediums: ['email'],
          smsTemplate: DEFAULT_SMS_TEMPLATE,
          emailTemplate: DEFAULT_EMAIL_TEMPLATE,
        },
      },
    ]);
  });

  it('applies the default charge-card config and sets a one-day interval when retries are raised', async () => {
    const user = userEvent.setup();
    render(<OutreachConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    const action = section('Invoice Issue Date').getByRole('group', { name: 'Send Notification action' });
    await user.click(within(action).getByRole('combobox', { name: 'Action Type' }));
    await user.click(screen.getByRole('option', { name: 'Charge Credit Card on File' }));
    expect(screen.getByRole('spinbutton', { name: 'Retry interval days' })).toBeDisabled();
    await user.type(screen.getByRole('spinbutton', { name: 'Retry attempts' }), '2');
    expect(screen.getByRole('spinbutton', { name: 'Retry interval days' })).toHaveValue(1);
    await user.click(saveButton());
    expect(mocks.save.mock.calls[0][1].actions[0]).toEqual({
      id: 'reminder-id',
      trigger: reminder.trigger,
      actionType: 'charge-card',
      chargeCardConfig: {
        onSuccess: defaultNotificationConfig(),
        onFailure: defaultNotificationConfig(),
        retryAttempts: 2,
        retryIntervalDays: 1,
      },
    });
  });

  it('blocks saving an empty template', async () => {
    const user = userEvent.setup();
    render(<OutreachConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    await user.clear(screen.getByRole('textbox', { name: 'SMS Template' }));
    await user.click(saveButton());
    expect(screen.getByText('SMS Template is required')).toBeVisible();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
