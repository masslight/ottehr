import { ProcedureQuickPickDialogs } from 'src/features/visits/in-person/components/procedures/ProcedureQuickPickDialogs';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Update existing procedure quick pick?',
  source: 'apps/ehr/src/features/visits/in-person/components/procedures/ProcedureQuickPickDialogs.tsx',
  base: 'MUI Dialog',
  kind: 'confirm',
  where: 'In-person visit → Procedure form → Add to Quick Picks → Save with a name that already exists',
  render: () => (
    <ProcedureQuickPickDialogs
      open
      name="Splint application"
      onNameChange={() => undefined}
      existingQuickPicks={[
        { id: 'qp-1', name: 'Splint application' },
        { id: 'qp-2', name: 'I&D abscess' },
      ]}
      saving={false}
      onClose={() => undefined}
      onSave={() => undefined}
    />
  ),
  play: async ({ user, screen }) => {
    await user.click(screen.getByRole('button', { name: 'Save Quick Pick' }));
  },
  notes: 'Stacked on top of the still-open "Add to Quick Picks" dialog, as in the product.',
});
