import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoiceConfigResponse, SaveInvoiceConfigInput } from 'utils/lib/types/api/invoice-config.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InvoicingConfiguration from '../../src/pages/InvoicingConfiguration';

const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), snackbar: vi.fn(), client: {} }));
vi.mock('../../src/api/api', () => ({ getInvoiceConfig: mocks.get, saveInvoiceConfig: mocks.save }));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: mocks.client }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: mocks.snackbar }));

const saved: SaveInvoiceConfigInput = {
  dueDaysFromGeneration: 14,
  defaultSmsTemplate: 'Hello {{patient-full-name}}.\nPlease pay {{amount}}.',
  defaultInvoiceMemo: 'Visit on {{visit-date}} at {{clinic}}.',
};

function config(values = saved): InvoiceConfigResponse {
  return {
    questionnaire: { resourceType: 'Questionnaire', status: 'active' },
    questionnaireResponse: {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      item: [
        {
          linkId: 'invoicing',
          item: [
            { linkId: 'invoicing.dueDaysFromGeneration', answer: [{ valueInteger: values.dueDaysFromGeneration }] },
            { linkId: 'invoicing.defaultSmsTemplate', answer: [{ valueString: values.defaultSmsTemplate }] },
            { linkId: 'invoicing.defaultInvoiceMemo', answer: [{ valueString: values.defaultInvoiceMemo }] },
          ],
        },
      ],
    },
  };
}

function pendingResponse(): {
  promise: Promise<InvoiceConfigResponse>;
  resolve: (value: InvoiceConfigResponse) => void;
} {
  let resolve!: (value: InvoiceConfigResponse) => void;
  const promise = new Promise<InvoiceConfigResponse>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const dueDays = (): HTMLElement => screen.getByRole('spinbutton', { name: 'Invoice Due Days' });
const sms = (): HTMLElement => screen.getByRole('textbox', { name: 'Default SMS Message Template' });
const memo = (): HTMLElement => screen.getByRole('textbox', { name: 'Default Invoice Memo Template' });
const saveButton = (): HTMLElement => screen.getByRole('button', { name: 'Save changes' });

describe('Invoicing Configuration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.client = {};
    mocks.get.mockResolvedValue(config());
    mocks.save.mockResolvedValue(config());
  });

  it('waits for saved settings before showing the form and preserves template tokens and newlines', async () => {
    const load = pendingResponse();
    mocks.get.mockReturnValueOnce(load.promise);
    render(<InvoicingConfiguration />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    await act(async () => load.resolve(config()));
    expect(dueDays()).toHaveValue(14);
    expect(sms()).toHaveValue(saved.defaultSmsTemplate);
    expect(memo()).toHaveValue(saved.defaultInvoiceMemo);
    expect(saveButton()).toBeDisabled();
  });

  it('resets all unsaved fields to the loaded settings', async () => {
    const user = userEvent.setup();
    render(<InvoicingConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    await user.clear(dueDays());
    await user.type(dueDays(), '30');
    await user.type(sms(), ' Updated SMS');
    await user.type(memo(), ' Updated memo');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(dueDays()).toHaveValue(14);
    expect(sms()).toHaveValue(saved.defaultSmsTemplate);
    expect(memo()).toHaveValue(saved.defaultInvoiceMemo);
    expect(saveButton()).toBeDisabled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each(['', '0', '366', '1.5'])('prevents saving invalid due days: "%s"', async (value) => {
    const user = userEvent.setup();
    render(<InvoicingConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    await user.clear(dueDays());
    if (value) await user.type(dueDays(), value);
    await user.click(saveButton());
    expect(await screen.findByText('Enter a whole number from 1 to 365')).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('prevents saving empty or whitespace-only templates', async () => {
    const user = userEvent.setup();
    render(<InvoicingConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    await user.clear(sms());
    await user.clear(memo());
    await user.type(memo(), '   ');
    await user.click(saveButton());
    expect(await screen.findByText('Default SMS Message Template is required')).toBeInTheDocument();
    expect(screen.getByText('Default Invoice Memo Template is required')).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('locks the form during save and resets later edits to the newly saved settings', async () => {
    const user = userEvent.setup();
    const save = pendingResponse();
    mocks.save.mockReturnValueOnce(save.promise);
    render(<InvoicingConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    await user.clear(dueDays());
    await user.type(dueDays(), '21');
    await user.type(sms(), ' Thank you.');
    await user.type(memo(), ' Thank you.');
    await user.click(saveButton());
    const updated = {
      dueDaysFromGeneration: 21,
      defaultSmsTemplate: saved.defaultSmsTemplate + ' Thank you.',
      defaultInvoiceMemo: saved.defaultInvoiceMemo + ' Thank you.',
    };
    expect(mocks.save).toHaveBeenCalledWith(mocks.client, updated);
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    expect(sms()).toBeDisabled();
    await act(async () => save.resolve(config(updated)));
    expect(saveButton()).toBeDisabled();
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.snackbar).toHaveBeenCalledWith('Invoicing settings saved', { variant: 'success' });
    await user.type(memo(), ' Unsaved');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(dueDays()).toHaveValue(21);
    expect(sms()).toHaveValue(updated.defaultSmsTemplate);
    expect(memo()).toHaveValue(updated.defaultInvoiceMemo);
  });

  it('keeps changes after a failed save and allows retry', async () => {
    const user = userEvent.setup();
    mocks.save.mockRejectedValueOnce(new Error('Unavailable'));
    render(<InvoicingConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    await user.type(sms(), ' Edited');
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to save invoicing settings');
    expect(sms()).toHaveValue(saved.defaultSmsTemplate + ' Edited');
    expect(mocks.snackbar).not.toHaveBeenCalled();
    await user.click(saveButton());
    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not offer defaults for saving after load fails and can retry loading', async () => {
    const user = userEvent.setup();
    mocks.get.mockRejectedValueOnce(new Error('Unavailable'));
    render(<InvoicingConfiguration />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load invoicing settings');
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('button', { name: 'Save changes' });
    expect(dueDays()).toHaveValue(14);
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it('preserves unsaved edits when the API client refreshes its token', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<InvoicingConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    await user.type(sms(), ' Edited');
    mocks.client = {};
    rerender(<InvoicingConfiguration />);
    expect(sms()).toHaveValue(saved.defaultSmsTemplate + ' Edited');
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it('previews each template independently without changing the saved tokens', async () => {
    const user = userEvent.setup();
    render(<InvoicingConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    const smsGroup = within(screen.getByRole('group', { name: 'Default SMS Message Template' }));
    const memoGroup = within(screen.getByRole('group', { name: 'Default Invoice Memo Template' }));
    await user.click(smsGroup.getByRole('tab', { name: 'Preview' }));
    expect(smsGroup.getByText('Hello Jane Smith. Please pay $125.00.')).toHaveTextContent('Hello Jane Smith.');
    expect(smsGroup.getByText('Preview uses sample values.')).toBeVisible();
    expect(memo()).toHaveValue(saved.defaultInvoiceMemo);
    expect(saveButton()).toBeDisabled();
    await user.click(memoGroup.getByRole('tab', { name: 'Preview' }));
    expect(memoGroup.getByText('Visit on Sunday, March 15, 2026 at Ottehr Clinic.')).toBeVisible();
    await user.click(smsGroup.getByRole('tab', { name: 'Write' }));
    expect(sms()).toHaveValue(saved.defaultSmsTemplate);
    expect(saveButton()).toBeDisabled();
  });

  it('offers all eight tokens and inserts a token at the selection without submitting', async () => {
    const user = userEvent.setup();
    render(<InvoicingConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    const group = within(screen.getByRole('group', { name: 'Default SMS Message Template' }));
    expect(group.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '{{patient-full-name}}',
      '{{clinic}}',
      '{{location}}',
      '{{visit-date}}',
      '{{due-date}}',
      '{{amount}}',
      '{{invoice-link}}',
      '{{patient-portal-link}}',
    ]);
    const input = sms() as HTMLTextAreaElement;
    await user.click(input);
    input.setSelectionRange(0, 5);
    await user.click(group.getByRole('button', { name: '{{clinic}}' }));
    expect(input).toHaveValue('{{clinic}}' + saved.defaultSmsTemplate.slice(5));
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe('{{clinic}}'.length);
    expect(input.selectionEnd).toBe('{{clinic}}'.length);
    await user.keyboard('!');
    expect(input).toHaveValue('{{clinic}}!' + saved.defaultSmsTemplate.slice(5));
    expect(memo()).toHaveValue(saved.defaultInvoiceMemo);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('supports keyboard token insertion and saves tokens while both templates are in Preview', async () => {
    const user = userEvent.setup();
    render(<InvoicingConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    const smsGroup = within(screen.getByRole('group', { name: 'Default SMS Message Template' }));
    const memoGroup = within(screen.getByRole('group', { name: 'Default Invoice Memo Template' }));
    await user.click(sms());
    await user.tab();
    expect(smsGroup.getByRole('button', { name: '{{patient-full-name}}' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(sms()).toHaveValue(saved.defaultSmsTemplate + '{{patient-full-name}}');
    expect(mocks.save).not.toHaveBeenCalled();
    await user.click(smsGroup.getByRole('tab', { name: 'Preview' }));
    await user.click(memoGroup.getByRole('tab', { name: 'Preview' }));
    await user.click(saveButton());
    expect(mocks.save).toHaveBeenCalledWith(mocks.client, {
      ...saved,
      defaultSmsTemplate: saved.defaultSmsTemplate + '{{patient-full-name}}',
    });
  });

  it('updates Preview and Write together when unsaved changes are reset', async () => {
    const user = userEvent.setup();
    render(<InvoicingConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    const group = within(screen.getByRole('group', { name: 'Default SMS Message Template' }));
    await user.type(sms(), ' Unsaved change');
    await user.click(group.getByRole('tab', { name: 'Preview' }));
    expect(group.getByText(/Unsaved change/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(group.queryByText(/Unsaved change/)).not.toBeInTheDocument();
    expect(group.getByText('Hello Jane Smith. Please pay $125.00.')).toBeVisible();
    await user.click(group.getByRole('tab', { name: 'Write' }));
    expect(sms()).toHaveValue(saved.defaultSmsTemplate);
    expect(saveButton()).toBeDisabled();
  });

  it('opens Write to show validation errors when invalid templates are in Preview', async () => {
    const user = userEvent.setup();
    render(<InvoicingConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    await user.clear(sms());
    await user.clear(memo());
    for (const tab of screen.getAllByRole('tab', { name: 'Preview' })) await user.click(tab);
    await user.click(saveButton());
    expect(await screen.findByText('Default SMS Message Template is required')).toBeVisible();
    expect(screen.getByText('Default Invoice Memo Template is required')).toBeVisible();
    expect(sms()).toHaveValue('');
    expect(memo()).toHaveValue('');
    await user.click(screen.getAllByRole('tab', { name: 'Preview' })[0]);
    expect(screen.getByText('Default SMS Message Template is required')).toBeVisible();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('disables token insertion and tabs while saving', async () => {
    const user = userEvent.setup();
    const save = pendingResponse();
    mocks.save.mockReturnValueOnce(save.promise);
    render(<InvoicingConfiguration />);
    await screen.findByRole('button', { name: 'Save changes' });
    await user.type(sms(), ' Edited');
    await user.click(saveButton());
    const group = within(screen.getByRole('group', { name: 'Default SMS Message Template' }));
    const token = group.getByRole('button', { name: '{{clinic}}' });
    expect(token).toBeDisabled();
    expect(group.getByRole('tab', { name: 'Preview' })).toBeDisabled();
    expect(sms()).toHaveValue(saved.defaultSmsTemplate + ' Edited');
    await act(async () => save.resolve(config()));
    expect(token).not.toBeDisabled();
  });
});
