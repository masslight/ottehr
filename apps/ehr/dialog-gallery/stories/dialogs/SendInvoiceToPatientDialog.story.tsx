import SendInvoiceToPatientDialog from 'src/components/dialogs/SendInvoiceToPatientDialog';
import { defineStory } from '../../harness/story';
import { invoiceReport } from './_fixtures';

export default defineStory({
  title: 'Send invoice to patient',
  source: 'apps/ehr/src/components/dialogs/SendInvoiceToPatientDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Reports → Invoiceable patients → send invoice',
  // An empty invoice config makes the dialog fall back to the built-in default SMS/memo templates and due days.
  mocks: [{ url: 'get-invoice-config', response: { status: 200, output: {} } }],
  notes:
    'title / submit label are the ones InvoiceablePatients passes. Mock report; SMS + memo are the app default templates; due date is computed from the capture date.',
  render: () => (
    <SendInvoiceToPatientDialog
      modalOpen
      title="Send invoice"
      submitButtonName="Send Invoice"
      handleClose={() => undefined}
      onSubmit={async () => undefined}
      report={invoiceReport}
    />
  ),
  play: async ({ waitFor }) => {
    await waitFor(() => {
      const amount = document.querySelector<HTMLInputElement>('.MuiDialog-paper input[name="amount"]');
      if (!amount || amount.disabled || amount.value === '') throw new Error('form not prefilled yet');
    });
  },
});
