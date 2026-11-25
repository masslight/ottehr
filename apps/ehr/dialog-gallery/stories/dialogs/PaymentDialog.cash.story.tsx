import PaymentDialog from 'src/components/dialogs/PaymentDialog';
import { defineStory } from '../../harness/story';
import { patient } from './_fixtures';

export default defineStory({
  title: 'Take payment (cash: "Record Payment")',
  source: 'apps/ehr/src/components/dialogs/PaymentDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Patient payments list / patient balances → "Add Payment" → Cash',
  mocks: [
    {
      url: 'payment-methods-setup',
      response: { status: 200, output: { clientSecret: 'seti_mock_secret_mock', stripeAccount: undefined } },
    },
    { url: 'payment-methods-list', response: { status: 200, output: { cards: [] } } },
  ],
  notes:
    'Same dialog as PaymentDialog with the "Cash" method picked: the card selector is hidden and the primary button reads "Record Payment" instead of "Process Payment".',
  render: () => (
    <PaymentDialog
      open
      patient={patient}
      encounterId="enc-1"
      appointmentId="appt-1"
      isSubmitting={false}
      handleClose={() => undefined}
      submitPayment={async () => undefined}
    />
  ),
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('radio', { name: 'Cash' }));
    await screen.findByRole('button', { name: 'Record Payment' });
  },
});
