import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('records the whole balance with the method, date and reference entered', async () => {
    renderDialog();
    const amount = screen.getByRole('textbox', { name: 'Amount' });
    expect(amount).toHaveValue('320.00');
    expect(amount).toBeDisabled();

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
});
