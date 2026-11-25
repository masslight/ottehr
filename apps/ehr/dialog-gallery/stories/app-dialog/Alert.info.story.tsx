import { AppDialog } from 'src/components/dialogs/AppDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'AppDialog · alert, information only',
  source: 'apps/ehr/src/components/dialogs/AppDialog.tsx',
  base: 'AppDialog',
  kind: 'info',
  where: 'New standard shell; content matches the information-only Alert mockup in the design proposal',
  render: () => (
    <AppDialog variant="alert" open onClose={() => undefined} title="eRX Pending Review">
      Your eRx enrollment has been submitted and is being reviewed. You can prescribe once it is approved.
    </AppDialog>
  ),
});
