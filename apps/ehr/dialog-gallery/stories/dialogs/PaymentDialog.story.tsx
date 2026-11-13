import PaymentDialog from 'src/components/dialogs/PaymentDialog';
import { defineStory } from '../../harness/story';
import { patient } from './_fixtures';

export default defineStory({
  title: 'Take payment',
  source: 'apps/ehr/src/components/dialogs/PaymentDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Patient payments list / patient balances → "Add Payment"',
  mocks: [
    {
      url: 'payment-methods-setup',
      response: { status: 200, output: { clientSecret: 'seti_mock_secret_mock', stripeAccount: undefined } },
    },
    {
      url: 'payment-methods-list',
      response: {
        status: 200,
        output: {
          cards: [
            {
              id: 'pm_1QExampleCard4242AbCdEfGh',
              brand: 'visa',
              expMonth: 8,
              expYear: 2029,
              lastFour: '4242',
              default: true,
            },
            { id: 'pm_1QExampleCard5555AbCdEfGh', brand: 'mastercard', expMonth: 2, expYear: 2028, lastFour: '5555' },
          ],
        },
      },
    },
  ],
  notes:
    'Default "Card" method with two mocked saved cards (primary preselected). Stripe.js cannot load in the sandbox, so the "Add new card" Stripe Elements form (only shown when no card is on file or "Add new card" is picked) and the "Card Reader" terminal variant are not shown.',
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
  play: async ({ waitFor }) => {
    await waitFor(
      () => {
        const input = document.querySelector<HTMLInputElement>('.MuiDialog-paper .MuiAutocomplete-input');
        if (!input?.value.includes('4242')) throw new Error('saved card not selected yet');
      },
      { timeout: 8000 }
    );
  },
});
