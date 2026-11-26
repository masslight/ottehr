import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DateTime } from 'luxon';
import { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordInvoicePaymentDialog } from '../../src/components/RecordInvoicePaymentDialog';

const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  presign: vi.fn(),
  upload: vi.fn(),
  onClose: vi.fn(),
  onRecorded: vi.fn(),
  client: {},
}));
vi.mock('../../src/api/api', () => ({
  recordBillingNioInvoicePayment: mocks.record,
  presignBillingInvoicePaymentAttachment: mocks.presign,
}));
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: mocks.client,
  }),
}));
vi.mock('utils/lib/helpers/presigned-file-url/helpers', () => ({
  uploadObjectToZ3: mocks.upload,
}));
vi.mock('../../src/components/DateInput', async () => ({
  DateInput: (await import('./inputStub')).InputStub,
}));

const renderDialog = (): void => {
  render(
    <RecordInvoicePaymentDialog
      open
      onClose={mocks.onClose}
      onRecorded={mocks.onRecorded}
      invoice={{
        id: 'invoice-1',
        balance: 320,
      }}
      idempotencyKey="payment-key-1"
    />
  );
};

const fillPayment = (): void => {
  const paymentDate = screen.getByLabelText('Payment date *');
  fireEvent.change(paymentDate, {
    target: {
      value: '2026-11-18',
    },
  });
  const wire = screen.getByRole('radio', { name: 'Wire' });
  fireEvent.click(wire);
  const reference = screen.getByRole('textbox', { name: 'Reference #' });
  fireEvent.change(reference, {
    target: {
      value: ' WIRE-88 ',
    },
  });
};

const submit = (): void => {
  const recordPayment = within(screen.getByRole('dialog')).getByRole('button', { name: 'Record payment' });
  fireEvent.click(recordPayment);
};

describe('RecordInvoicePaymentDialog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.record.mockResolvedValue({
      paymentId: 'payment-1',
    });
    mocks.presign.mockResolvedValue({
      uploadUrl: 'https://z3.example/upload',
      path: 'invoice-attachments/invoice-1/abc-wire.pdf',
    });
    mocks.upload.mockResolvedValue(undefined);
  });

  it('records the balance by default with the method, date and reference entered', async () => {
    renderDialog();
    const amount = screen.getByRole('textbox', { name: 'Amount *' });
    expect(amount).toHaveValue('320.00');

    fillPayment();
    submit();

    await waitFor(() => expect(mocks.onRecorded).toHaveBeenCalled());
    expect(mocks.record).toHaveBeenCalledWith(mocks.client, {
      invoiceId: 'invoice-1',
      amountInCents: 32000,
      paymentMethod: 'wire',
      paymentDate: '2026-11-18',
      reference: 'WIRE-88',
      attachment: undefined,
      idempotencyKey: expect.any(String),
    });
    expect(mocks.presign).not.toHaveBeenCalled();
    expect(mocks.onClose).toHaveBeenCalled();
  });

  it('records an amount under the balance', async () => {
    renderDialog();
    fillPayment();
    const amount = screen.getByRole('textbox', { name: 'Amount *' });
    fireEvent.change(amount, {
      target: {
        value: '120.50',
      },
    });

    submit();

    await waitFor(() => expect(mocks.record).toHaveBeenCalled());
    expect(mocks.record).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({
        amountInCents: 12050,
      })
    );
  });

  it('refuses an amount over the balance without recording', async () => {
    renderDialog();
    fillPayment();
    const amount = screen.getByRole('textbox', { name: 'Amount *' });
    fireEvent.change(amount, {
      target: {
        value: '320.01',
      },
    });

    submit();

    expect(await screen.findByText('Enter at most $320.00')).toBeInTheDocument();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('refuses a payment date in the future without recording', async () => {
    renderDialog();
    fillPayment();
    const paymentDate = screen.getByLabelText('Payment date *');
    fireEvent.change(paymentDate, {
      target: {
        value: DateTime.now().plus({ days: 2 }).toISODate(),
      },
    });

    submit();

    expect(await screen.findByText("Payment date can't be in the future")).toBeInTheDocument();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('uploads the attachment before recording the payment with it', async () => {
    renderDialog();
    fillPayment();
    const file = new File(['%PDF'], 'wire.pdf', {
      type: 'application/pdf',
    });
    const input = screen.getByLabelText('Upload attachment');
    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });
    await screen.findByText('wire.pdf', {
      selector: '.MuiListItemText-primary',
    });

    submit();

    await waitFor(() => expect(mocks.record).toHaveBeenCalled());
    expect(mocks.presign).toHaveBeenCalledWith(mocks.client, {
      invoiceId: 'invoice-1',
      fileName: 'wire.pdf',
    });
    expect(mocks.upload).toHaveBeenCalledWith(file, 'https://z3.example/upload', 'application/pdf');
    expect(mocks.record).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({
        attachment: {
          path: 'invoice-attachments/invoice-1/abc-wire.pdf',
          fileName: 'wire.pdf',
          mimeType: 'application/pdf',
        },
      })
    );
  });

  it('resends a failed payment under the same key and file, and keeps the dialog open with the error', async () => {
    mocks.record.mockRejectedValueOnce(new Error('Network error'));
    renderDialog();
    fillPayment();
    const input = screen.getByLabelText('Upload attachment');
    fireEvent.change(input, {
      target: {
        files: [
          new File(['%PDF'], 'wire.pdf', {
            type: 'application/pdf',
          }),
        ],
      },
    });
    await screen.findByText('wire.pdf', {
      selector: '.MuiListItemText-primary',
    });

    submit();

    expect(await screen.findByText('Network error')).toBeInTheDocument();
    expect(mocks.onClose).not.toHaveBeenCalled();
    submit();
    await waitFor(() => expect(mocks.onRecorded).toHaveBeenCalled());
    const [[, first], [, second]] = mocks.record.mock.calls;
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.attachment).toEqual(first.attachment);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });

  it('keeps its key when the details are edited after a failure', async () => {
    mocks.record.mockRejectedValueOnce(new Error('Network error'));
    renderDialog();
    fillPayment();

    submit();
    await screen.findByText('Network error');
    const reference = screen.getByRole('textbox', { name: 'Reference #' });
    fireEvent.change(reference, {
      target: {
        value: 'WIRE-89',
      },
    });
    submit();

    await waitFor(() => expect(mocks.onRecorded).toHaveBeenCalled());
    const [[, first], [, second]] = mocks.record.mock.calls;
    expect(second.reference).toBe('WIRE-89');
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });

  it('resends the amount it first sent after a refetch shows the invoice paid', async () => {
    mocks.record.mockRejectedValueOnce(new Error('Network error'));
    const dialog = (balance: number): ReactElement => (
      <RecordInvoicePaymentDialog
        open
        onClose={mocks.onClose}
        onRecorded={mocks.onRecorded}
        invoice={{
          id: 'invoice-1',
          balance,
        }}
        idempotencyKey="payment-key-1"
      />
    );
    const { rerender } = render(dialog(320));
    fillPayment();

    submit();
    await screen.findByText('Network error');
    rerender(dialog(0));
    submit();

    await waitFor(() => expect(mocks.onRecorded).toHaveBeenCalled());
    const [[, first], [, second]] = mocks.record.mock.calls;
    expect(second).toEqual(first);
    expect(second.amountInCents).toBe(32000);
  });
});
