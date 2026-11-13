import { ProcedureQuickPickDialogs } from 'src/features/visits/in-person/components/procedures/ProcedureQuickPickDialogs';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Add procedure to quick picks',
  source: 'apps/ehr/src/features/visits/in-person/components/procedures/ProcedureQuickPickDialogs.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'In-person visit → Procedure form → Quick picks → add current procedure (admin)',
  render: () => (
    <ProcedureQuickPickDialogs
      open
      name="Laceration repair - simple"
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
});
