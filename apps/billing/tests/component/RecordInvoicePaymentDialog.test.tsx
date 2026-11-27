import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DateTime } from 'luxon';
import { ReactElement, useState } from 'react';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualPaymentAttempt, RecordInvoicePaymentDialog } from '../../src/components/RecordInvoicePaymentDialog';

const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  presign: vi.fn(),
  upload: vi.fn(),
  onClose: vi.fn(),
  onRecorded: vi.fn(),
  onUnresolvedAttemptChange: vi.fn(),
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

// Holds the attempt like the invoice page does.
function DialogKeepingAttempt({
  balance,
  initialAttempt = null,
}: {
  balance: number;
  initialAttempt?: ManualPaymentAttempt | null;
}): ReactElement {
  const [attempt, setAttempt] = useState(initialAttempt);
  return (
    <RecordInvoicePaymentDialog
      open
      onClose={mocks.onClose}
      onRecorded={mocks.onRecorded}
      invoice={{
        id: 'invoice-1',
        balance,
      }}
      unresolvedAttempt={attempt}
      onUnresolvedAttemptChange={(next) => {
        mocks.onUnresolvedAttemptChange(next);
        setAttempt(next);
      }}
    />
  );
}

const renderDialog = (
  balance = 320,
  initialAttempt: ManualPaymentAttempt | null = null
): ((nextBalance: number) => void) => {
  const dialog = (invoiceBalance: number): ReactElement => (
    <DialogKeepingAttempt balance={invoiceBalance} initialAttempt={initialAttempt} />
  );
  const { rerender } = render(dialog(balance));
  return (nextBalance) => rerender(dialog(nextBalance));
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

const attachFile = async (): Promise<void> => {
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
};

const dialogButton = (name: string): HTMLElement =>
  within(screen.getByRole('dialog')).getByRole('button', {
    name,
  });

const submit = (): void => {
  const recordPayment = dialogButton('Record payment');
  fireEvent.click(recordPayment);
};

const tryAgain = (): void => {
  const retry = dialogButton('Try again');
  fireEvent.click(retry);
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
    await attachFile();

    submit();

    await waitFor(() => expect(mocks.record).toHaveBeenCalled());
    expect(mocks.presign).toHaveBeenCalledWith(mocks.client, {
      invoiceId: 'invoice-1',
      fileName: 'wire.pdf',
    });
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'wire.pdf',
      }),
      'https://z3.example/upload',
      'application/pdf'
    );
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

  it('opens on an unresolved payment locked, and resends it unchanged', async () => {
    const attempt: ManualPaymentAttempt = {
      payment: {
        invoiceId: 'invoice-1',
        amountInCents: 10000,
        paymentMethod: 'wire',
        paymentDate: '2026-11-18',
        reference: 'WIRE-88',
        idempotencyKey: 'key-1',
      },
      file: null,
    };
    renderDialog(320, attempt);

    const amount = screen.getByRole('textbox', { name: 'Amount *' });
    const reference = screen.getByRole('textbox', { name: 'Reference #' });
    expect(amount).toHaveValue('100.00');
    expect(amount).toBeDisabled();
    expect(reference).toHaveValue('WIRE-88');
    expect(reference).toBeDisabled();
    tryAgain();

    await waitFor(() => expect(mocks.onRecorded).toHaveBeenCalled());
    expect(mocks.record).toHaveBeenCalledWith(mocks.client, attempt.payment);
    expect(mocks.onUnresolvedAttemptChange).toHaveBeenLastCalledWith(null);
  });

  it('locks the details after a failure that may have recorded, and resends them under the same key', async () => {
    mocks.record.mockRejectedValueOnce(new Error('Network error'));
    renderDialog();
    fillPayment();
    await attachFile();

    submit();

    expect(await screen.findByText('Network error')).toBeInTheDocument();
    expect(mocks.onClose).not.toHaveBeenCalled();
    const reference = screen.getByRole('textbox', { name: 'Reference #' });
    expect(reference).toBeDisabled();
    tryAgain();
    await waitFor(() => expect(mocks.onRecorded).toHaveBeenCalled());
    const [[, first], [, second]] = mocks.record.mock.calls;
    expect(second).toEqual(first);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });

  it('unlocks the details when a resent payment turns out refused, and records under a new key', async () => {
    mocks.record.mockRejectedValueOnce(new Error('Network error')).mockRejectedValueOnce({
      output: {
        code: APIErrorCode.INVALID_INPUT,
        message: 'The payment is too large',
      },
    });
    renderDialog();
    fillPayment();

    submit();
    await screen.findByText('Network error');
    tryAgain();
    await screen.findByText('The payment is too large');

    const amount = screen.getByRole('textbox', { name: 'Amount *' });
    expect(amount).toBeEnabled();
    fireEvent.change(amount, {
      target: {
        value: '100',
      },
    });
    submit();
    await waitFor(() => expect(mocks.onRecorded).toHaveBeenCalled());
    const [[, first], , [, third]] = mocks.record.mock.calls;
    expect(third.amountInCents).toBe(10000);
    expect(third.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('resends the amount it first sent after a refetch shows the invoice paid', async () => {
    mocks.record.mockRejectedValueOnce(new Error('Network error'));
    const setBalance = renderDialog();
    fillPayment();

    submit();
    await screen.findByText('Network error');
    setBalance(0);
    tryAgain();

    await waitFor(() => expect(mocks.onRecorded).toHaveBeenCalled());
    const [[, first], [, second]] = mocks.record.mock.calls;
    expect(second).toEqual(first);
    expect(second.amountInCents).toBe(32000);
  });
});
