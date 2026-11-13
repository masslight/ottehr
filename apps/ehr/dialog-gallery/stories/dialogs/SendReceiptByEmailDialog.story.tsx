import SendReceiptByEmailDialog from 'src/components/dialogs/SendReceiptByEmailDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Send receipt by email',
  source: 'apps/ehr/src/components/dialogs/SendReceiptByEmailDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Patient payments list → send receipt',
  notes:
    'Title and submit label are props; values used here are the ones passed by PatientPaymentsList. Recipient prefilled via defaultValues.',
  render: () => (
    <SendReceiptByEmailDialog
      modalOpen
      title="Send receipt"
      submitButtonName="Send Receipt"
      handleClose={() => undefined}
      onSubmit={async () => undefined}
      defaultValues={{ recipientName: 'Jordan Rivera', recipientEmail: 'jordan.rivera@example.com' }}
    />
  ),
});
