import CancellationReasonDialog from 'src/components/dialogs/CancellationReasonDialog';
import { defineStory } from '../../harness/story';
import { appointment, encounter } from './_fixtures';

export default defineStory({
  title: "Cancel visit — patient's cancelation reason",
  source: 'apps/ehr/src/components/dialogs/CancellationReasonDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Visit details page → "Cancel visit" button',
  notes: 'Initial state: no reason selected yet, so the submit button is disabled.',
  render: () => (
    <CancellationReasonDialog
      open
      handleClose={() => undefined}
      refetchData={async () => undefined}
      getAndSetResources={async () => undefined}
      appointment={appointment}
      encounter={encounter}
    />
  ),
});
