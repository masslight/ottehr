import { PendingErxEnrollmentDialog } from 'src/components/dialogs/PendingErxEnrollmentDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'eRx enrollment pending review',
  source: 'apps/ehr/src/components/dialogs/PendingErxEnrollmentDialog.tsx',
  base: 'CustomDialog',
  kind: 'info',
  where: 'Shown to a provider whose eRx enrollment is still under review when they try to prescribe',
  render: () => <PendingErxEnrollmentDialog open handleClose={() => undefined} />,
});
