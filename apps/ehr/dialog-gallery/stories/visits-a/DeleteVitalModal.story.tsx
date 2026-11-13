import { DeleteVitalModal } from 'src/features/visits/shared/components/vitals/DeleteVitalModal';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Delete vital',
  source: 'apps/ehr/src/features/visits/shared/components/vitals/DeleteVitalModal.tsx',
  base: 'InPersonModal',
  kind: 'destructive-confirm',
  where: 'Visit chart → Vitals → delete icon on a recorded vital',
  render: () => (
    <DeleteVitalModal
      open
      onClose={() => undefined}
      entity={{ resourceId: 'obs-1', field: 'vital-temperature', value: 37.2 } as any}
      onDelete={async () => undefined}
    />
  ),
  notes: 'Not in the original file list (uses the InPersonModal wrapper).',
});
