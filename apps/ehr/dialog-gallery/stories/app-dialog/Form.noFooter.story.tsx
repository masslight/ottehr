import { AppDialog } from 'src/components/dialogs/AppDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'AppDialog · form with no footer',
  source: 'apps/ehr/src/components/dialogs/AppDialog.tsx',
  base: 'AppDialog',
  kind: 'viewer',
  where: 'New standard shell; read-only content where ✕ is enough to close',
  render: () => (
    <AppDialog variant="form" size="s" open onClose={() => undefined} title="Activity Log">
      Appointment created by Dr. Maya Patel on 11/12/2026 at 10:20 AM.
    </AppDialog>
  ),
});
