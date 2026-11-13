import { DmeQuickPickDialogs } from 'src/features/dme/components/DmeQuickPickDialogs';
import { defineStory } from '../../harness/story';
import { existingQuickPicks } from './_dme';

export default defineStory({
  title: 'Replace existing DME quick pick?',
  source: 'apps/ehr/src/features/dme/components/DmeQuickPickDialogs.tsx',
  base: 'MUI Dialog',
  kind: 'confirm',
  where: 'In-person visit → DME order form → "Add to Quick Picks" → save under a name that already exists',
  render: () => (
    <DmeQuickPickDialogs
      open
      name="Wrist splint"
      onNameChange={() => undefined}
      existingQuickPicks={existingQuickPicks}
      saving={false}
      onClose={() => undefined}
      onSave={() => undefined}
    />
  ),
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Save Quick Pick' }));
    await screen.findByText('Update Existing Quick Pick?');
  },
  notes: 'Opens stacked on top of the "Add to Quick Picks" dialog, as in the product.',
});
