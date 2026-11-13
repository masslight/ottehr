import RemoveCardOnFileDialog from 'src/components/dialogs/RemoveCardOnFileDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Confirm card removal (step 2)',
  source: 'apps/ehr/src/components/dialogs/RemoveCardOnFileDialog.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'Card on File dialog → "Remove Card on File"',
  notes: 'Same Dialog element as step 1, after clicking "Remove Card on File".',
  render: () => <RemoveCardOnFileDialog open onClose={() => undefined} onRemove={() => undefined} />,
  play: async ({ user, screen }) => {
    await user.click(screen.getByRole('button', { name: 'Remove Card on File' }));
    await screen.findByText('Confirm Card Removal');
  },
});
