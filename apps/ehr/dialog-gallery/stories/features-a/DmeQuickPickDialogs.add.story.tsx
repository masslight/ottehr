import { DmeQuickPickDialogs } from 'src/features/dme/components/DmeQuickPickDialogs';
import { defineStory } from '../../harness/story';
import { existingQuickPicks } from './_dme';

export default defineStory({
  title: 'Add DME order to quick picks',
  source: 'apps/ehr/src/features/dme/components/DmeQuickPickDialogs.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'In-person visit → DME order form → "Add to Quick Picks"',
  render: () => (
    <DmeQuickPickDialogs
      open
      name="Wrist splint, left"
      onNameChange={() => undefined}
      existingQuickPicks={existingQuickPicks}
      saving={false}
      onClose={() => undefined}
      onSave={() => undefined}
    />
  ),
  notes: 'Rendered directly with a name already entered (the name state lives in the parent DmeOrderForm).',
});
