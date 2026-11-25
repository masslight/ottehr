import { AppDialog } from 'src/components/dialogs/AppDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'AppDialog · alert, error severity',
  source: 'apps/ehr/src/components/dialogs/AppDialog.tsx',
  base: 'AppDialog',
  kind: 'info',
  where: 'New standard shell; a failure the user must acknowledge',
  render: () => (
    <AppDialog variant="alert" severity="error" open onClose={() => undefined} title="Some Faxes Could Not Be Sent">
      2 of 3 recipients did not receive the fax. Check the fax numbers and try again.
    </AppDialog>
  ),
});
