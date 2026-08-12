import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FAX_MAX_TRANSMISSIONS, SEND_FAX_MAX_RECIPIENTS } from 'utils/lib/types/api/send-fax.types';
import { describe, expect, it, vi } from 'vitest';
import { SendFaxDialog } from '../../src/components/dialogs/SendFaxDialog';

const baseProps = {
  title: 'Fax Patient Docs',
  onClose: vi.fn(),
  onSend: vi.fn().mockResolvedValue(undefined),
};

const visits = [
  { appointmentId: 'appointment-1', label: '04/11/2026, 09:30' },
  { appointmentId: 'appointment-2', label: '07/02/2026, 11:30' },
];

const typeFaxNumber = async (user: ReturnType<typeof userEvent.setup>, value: string): Promise<void> => {
  await user.type(screen.getAllByLabelText(/Fax number/i)[0], value);
};

describe('SendFaxDialog', () => {
  it('sends the entered recipient', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SendFaxDialog {...baseProps} title="Send Fax" onSend={onSend} />);

    await user.type(screen.getByLabelText(/Recipient's name/i), 'Dr. Tomas Jhonson');
    await user.type(screen.getByLabelText(/Organization/i), 'Urgent Care Clinic');
    await typeFaxNumber(user, '2125551234');
    await user.click(screen.getByRole('button', { name: 'Send Fax' }));

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith({
        recipients: [
          {
            name: 'Dr. Tomas Jhonson',
            organization: 'Urgent Care Clinic',
            faxNumber: '2125551234',
            phoneNumber: '',
          },
        ],
        appointmentIds: undefined,
      })
    );
  });

  it('does not send without a valid fax number', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<SendFaxDialog {...baseProps} onSend={onSend} visits={visits} />);

    await typeFaxNumber(user, '123');
    await user.click(screen.getByRole('button', { name: 'Send Fax' }));

    await waitFor(() => expect(screen.getByText(/Fax number must be 10 digits/i)).toBeInTheDocument());
    expect(onSend).not.toHaveBeenCalled();
  });

  it('collects several recipients', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SendFaxDialog {...baseProps} title="Send Fax" onSend={onSend} />);

    await typeFaxNumber(user, '2125551234');
    await user.click(screen.getByRole('button', { name: /Add Recipient/i }));
    await user.type(screen.getAllByLabelText(/Fax number/i)[1], '2125559999');
    await user.click(screen.getByRole('button', { name: 'Send Fax' }));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0].recipients.map((r: { faxNumber: string }) => r.faxNumber)).toEqual([
      '2125551234',
      '2125559999',
    ]);
  });

  it('allows an added recipient to be removed', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SendFaxDialog {...baseProps} title="Send Fax" onSend={onSend} />);

    await typeFaxNumber(user, '2125551234');
    await user.click(screen.getByRole('button', { name: /Add Recipient/i }));
    await user.type(screen.getAllByLabelText(/Fax number/i)[1], '6465559999');
    await user.click(screen.getByRole('button', { name: /Remove Recipient/i }));
    await user.click(screen.getByRole('button', { name: 'Send Fax' }));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0].recipients).toHaveLength(1);
  });

  it('rejects the same recipient fax number twice', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<SendFaxDialog {...baseProps} title="Send Fax" onSend={onSend} />);

    await typeFaxNumber(user, '2125551234');
    await user.click(screen.getByRole('button', { name: /Add Recipient/i }));
    await user.type(screen.getAllByLabelText(/Fax number/i)[1], '2125551234');
    await user.click(screen.getByRole('button', { name: 'Send Fax' }));

    expect(await screen.findAllByText(/already been added/i)).not.toHaveLength(0);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('faxes a lone visit without asking which visit to send', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SendFaxDialog {...baseProps} onSend={onSend} visits={[visits[0]]} />);

    expect(screen.queryByText('Select Visits')).not.toBeInTheDocument();
    await typeFaxNumber(user, '2125551234');
    await user.click(screen.getByRole('button', { name: 'Send Fax' }));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0].appointmentIds).toEqual(['appointment-1']);
  });

  it('stops adding recipients at the supported maximum', async () => {
    const user = userEvent.setup();
    render(<SendFaxDialog {...baseProps} title="Send Fax" onSend={vi.fn()} />);

    const addRecipient = screen.getByRole('button', { name: /Add Recipient/i });
    for (let i = 1; i < SEND_FAX_MAX_RECIPIENTS; i++) {
      await user.click(addRecipient);
    }

    expect(screen.getAllByLabelText(/Fax number/i)).toHaveLength(SEND_FAX_MAX_RECIPIENTS);
    expect(addRecipient).toBeDisabled();
  });

  it('preselects only as many visits as one request can send', async () => {
    const manyVisits = Array.from({ length: FAX_MAX_TRANSMISSIONS + 5 }, (_, index) => ({
      appointmentId: `appointment-${index}`,
      label: `visit ${index}`,
    }));
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SendFaxDialog {...baseProps} onSend={onSend} visits={manyVisits} />);

    await typeFaxNumber(user, '2125551234');
    await user.click(screen.getByRole('button', { name: 'Send Fax' }));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0].appointmentIds).toHaveLength(FAX_MAX_TRANSMISSIONS);
  });

  it('blocks a selection that would send more faxes than one request allows', async () => {
    const manyVisits = Array.from({ length: FAX_MAX_TRANSMISSIONS }, (_, index) => ({
      appointmentId: `appointment-${index}`,
      label: `visit ${index}`,
    }));
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<SendFaxDialog {...baseProps} onSend={onSend} visits={manyVisits} />);

    // Every visit is selected, so a second recipient doubles the transmissions.
    await user.click(screen.getByRole('button', { name: /Add Recipient/i }));

    expect(screen.getByText(/at most 20 can be sent at once/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Fax' })).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('preselects every visit and sends only the ones left checked', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SendFaxDialog {...baseProps} onSend={onSend} visits={visits} />);

    await user.click(screen.getByRole('checkbox', { name: visits[1].label }));
    await typeFaxNumber(user, '2125551234');
    await user.click(screen.getByRole('button', { name: 'Send Fax' }));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0].appointmentIds).toEqual(['appointment-1']);
  });

  it('blocks sending when no visit is selected', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<SendFaxDialog {...baseProps} onSend={onSend} visits={visits} />);

    for (const visit of visits) {
      await user.click(screen.getByRole('checkbox', { name: visit.label }));
    }

    expect(screen.getByText(/Select at least one visit/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send Fax' })).toBeDisabled();
  });

  it('keeps the dialog open when the send fails', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('fax provider unavailable'));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SendFaxDialog {...baseProps} title="Send Fax" onSend={onSend} onClose={onClose} />);

    await typeFaxNumber(user, '2125551234');
    await user.click(screen.getByRole('button', { name: 'Send Fax' }));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    // The entered recipient survives the failure so the user can retry without retyping it.
    expect(within(screen.getByRole('dialog')).getByLabelText(/Fax number/i)).toHaveValue('(212) 555-1234');
  });
});
