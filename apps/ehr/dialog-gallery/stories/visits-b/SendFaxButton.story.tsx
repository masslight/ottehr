import { SendFaxButton } from 'src/features/visits/shared/components/review-tab/SendFaxButton';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Send fax (single number)',
  source: 'apps/ehr/src/features/visits/shared/components/review-tab/SendFaxButton.tsx',
  base: 'ConfirmationDialog',
  kind: 'form',
  where: 'Radiology order details / DME order → "Send Fax" button',
  notes: 'Fax number prefilled through the real initialFaxNumber prop (as the order flows do when a number is known).',
  render: () => <SendFaxButton onSend={async () => undefined} initialFaxNumber="2125550187" />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Send Fax' }));
    await screen.findByRole('dialog');
  },
});
