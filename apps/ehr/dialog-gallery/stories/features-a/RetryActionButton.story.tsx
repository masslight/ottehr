import { RetryActionButton } from 'src/features/action-logs/RetryActionButton';
import { ActionLogEntry } from 'utils/lib/types/api/action-logs.types';
import { defineStory } from '../../harness/story';

const log: ActionLogEntry = {
  attemptId: '0b1d3f52-6a7c-4c59-9c3e-5a1f2b3c4d5e',
  channel: 'fax',
  status: 'failed',
  recipientAddress: '+12125550143',
  recipientName: 'Dr. Maria Alvarez',
  senderAddress: '+12125550100',
  patientName: 'John Carter',
  documentTitle: 'Visit note',
  canRetry: true,
} as ActionLogEntry;

export default defineStory({
  title: 'Resend a failed delivery (action log retry)',
  source: 'apps/ehr/src/features/action-logs/RetryActionButton.tsx',
  base: 'ConfirmationDialog',
  kind: 'confirm',
  where: 'Action logs → failed fax row → "Try again"',
  render: () => <RetryActionButton log={log} onResent={() => undefined} />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await screen.findByRole('dialog');
  },
});
