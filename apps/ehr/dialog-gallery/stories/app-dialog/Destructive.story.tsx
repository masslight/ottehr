import { AppDialog } from 'src/components/dialogs/AppDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'AppDialog · destructive',
  source: 'apps/ehr/src/components/dialogs/AppDialog.tsx',
  base: 'AppDialog',
  kind: 'destructive-confirm',
  where: 'New standard shell; content matches the Destructive mockup in the design proposal',
  render: () => (
    <AppDialog
      variant="destructive"
      open
      onClose={() => undefined}
      title="Delete This Note?"
      primary={{ label: 'Delete Note', onClick: () => undefined }}
    >
      “Follow-up on lab results” by Dr. Patel, 12 Nov 2026 will be removed from the chart. This can&apos;t be undone.
    </AppDialog>
  ),
});
