import PaymentDetailsDialog from 'src/components/dialogs/PaymentDetailsDialog';
import { defineStory } from '../../harness/story';
import { cardPayment } from './_payments';

export default defineStory({
  title: 'Payment details (partially refunded)',
  source: 'apps/ehr/src/components/dialogs/PaymentDetailsDialog.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Patient payments list → click a payment row that has a refund',
  notes:
    'Same dialog as PaymentDetailsDialog, with a mock partial refund so the status chip, alert and Transactions table render.',
  render: () => (
    <PaymentDetailsDialog
      open
      payment={{
        ...cardPayment,
        refundedAmountInCents: 2500,
        refunds: [
          {
            stripeRefundId: 're_3QExampleRefund0001',
            amountInCents: 2500,
            dateISO: '2026-11-12T10:05:00.000-05:00',
            status: 'succeeded',
            reason: 'Overcharge',
            refundedBy: 'Dana Whitfield',
          },
        ],
      }}
      encounterId="enc-1"
      canManagePayments
      onPaymentChanged={async () => undefined}
      handleClose={() => undefined}
    />
  ),
});
