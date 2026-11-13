import PaymentDetailsDialog from 'src/components/dialogs/PaymentDetailsDialog';
import { defineStory } from '../../harness/story';
import { cardPayment } from './_payments';

export default defineStory({
  title: 'Record external refund (card)',
  source: 'apps/ehr/src/components/dialogs/PaymentDetailsDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Payment Details dialog → "Record External Refund"',
  notes:
    'PaymentActionDialog (file-private) in its external-refund variant, stacked on top of Payment Details; initial state.',
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
    await user.click(screen.getByRole('button', { name: 'Record External Refund' }));
    await screen.findByLabelText(/Reason/);
  },
});
