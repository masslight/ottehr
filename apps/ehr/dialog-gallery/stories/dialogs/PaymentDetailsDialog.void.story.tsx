import PaymentDetailsDialog from 'src/components/dialogs/PaymentDetailsDialog';
import { defineStory } from '../../harness/story';
import { cashPayment } from './_payments';

export default defineStory({
  title: 'Void payment (cash)',
  source: 'apps/ehr/src/components/dialogs/PaymentDetailsDialog.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'Payment Details dialog (cash/check payment) → "Void Payment"',
  notes:
    'PaymentActionDialog (file-private) in its void variant, stacked on top of Payment Details for a cash payment; initial state.',
  render: () => (
    <PaymentDetailsDialog
      open
      payment={cashPayment}
      encounterId="enc-1"
      canManagePayments
      onPaymentChanged={async () => undefined}
      handleClose={() => undefined}
    />
  ),
  play: async ({ user, screen }) => {
    await user.click(screen.getByRole('button', { name: 'Void Payment' }));
    await screen.findByLabelText(/Reason/);
  },
});
