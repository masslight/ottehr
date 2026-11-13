import PaymentDetailsDialog from 'src/components/dialogs/PaymentDetailsDialog';
import { defineStory } from '../../harness/story';
import { cardPayment } from './_payments';

export default defineStory({
  title: 'Refund payment (card)',
  source: 'apps/ehr/src/components/dialogs/PaymentDetailsDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Payment Details dialog → "Refund Payment"',
  notes:
    'PaymentActionDialog (file-private) stacked on top of Payment Details; card payment, refund amount prefilled with the full remaining amount, reason not yet chosen (submit disabled). canManagePayments=true (Billing Admin).',
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
  play: async ({ user, screen }) => {
    await user.click(screen.getByRole('button', { name: 'Refund Payment' }));
    await screen.findByLabelText(/Reason/);
  },
});
