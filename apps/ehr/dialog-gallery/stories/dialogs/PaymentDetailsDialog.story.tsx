import PaymentDetailsDialog from 'src/components/dialogs/PaymentDetailsDialog';
import { defineStory } from '../../harness/story';
import { cardPayment } from './_payments';

export default defineStory({
  title: 'Payment details',
  source: 'apps/ehr/src/components/dialogs/PaymentDetailsDialog.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Patient payments list → click a payment row',
  notes:
    'Mock card payment with no refunds, so the refund alert and the Transactions table (shown only once a refund exists) are absent. canManagePayments=true (Billing Admin).',
  render: () => (
    <PaymentDetailsDialog
      open
      payment={cardPayment}
      encounterId="enc-1"
      canManagePayments
      onPaymentChanged={async () => undefined}
      handleClose={() => undefined}
    />
  ),
});
