import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { PatientPaymentDTO } from 'utils/lib/types/api/patient-payment-types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: { zambda: { execute: () => Promise.resolve({}) } } }),
}));

import PaymentDetailsDialog from '../../src/components/dialogs/PaymentDetailsDialog';

const renderDialog = (payment: PatientPaymentDTO): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PaymentDetailsDialog
        open
        payment={payment}
        encounterId="enc-1"
        canManagePayments
        onPaymentChanged={() => Promise.resolve()}
        handleClose={() => undefined}
      />
    </QueryClientProvider>
  );
};

const base = {
  amountInCents: 4000,
  dateISO: '2026-10-21T15:00:00.000Z',
  fhirPaymentNotificationId: 'notice-1',
};

describe('PaymentDetailsDialog refund actions', () => {
  it.each<[string, PatientPaymentDTO]>([
    [
      'a card payment taken through a PaymentIntent',
      { ...base, paymentMethod: 'card', stripePaymentId: 'pi_1', stripePaymentMethodId: undefined },
    ],
    [
      'a terminal payment taken through a PaymentIntent',
      { ...base, paymentMethod: 'card-reader', stripePaymentId: 'pi_1' },
    ],
  ])('offers both refunds for %s', (_name, payment) => {
    renderDialog(payment);

    expect(screen.getByRole('button', { name: 'Refund Payment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record External Refund' })).toBeInTheDocument();
  });

  it.each<[string, PatientPaymentDTO]>([
    [
      'a card payment Stripe recorded as a bare charge',
      { ...base, paymentMethod: 'card', stripePaymentId: undefined, stripePaymentMethodId: undefined },
    ],
    ['a terminal payment Stripe recorded as a bare charge', { ...base, paymentMethod: 'card-reader' }],
  ])('offers no refund for %s', (_name, payment) => {
    renderDialog(payment);

    expect(screen.queryByRole('button', { name: 'Refund Payment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record External Refund' })).not.toBeInTheDocument();
  });

  it('still offers a manual refund for a cash payment', () => {
    renderDialog({ ...base, paymentMethod: 'cash' });

    expect(screen.getByRole('button', { name: 'Record Refund' })).toBeInTheDocument();
  });
});
