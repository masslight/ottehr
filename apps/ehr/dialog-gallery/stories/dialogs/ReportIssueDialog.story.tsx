import ReportIssueDialog from 'src/components/dialogs/ReportIssueDialog';
import { defineStory } from '../../harness/story';
import { appointment, encounter, patient } from './_fixtures';

export default defineStory({
  title: 'Report issue',
  source: 'apps/ehr/src/components/dialogs/ReportIssueDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Visit details page → "Report Issue" button',
  notes: 'Initial empty state (submit disabled until details are typed).',
  render: () => (
    <ReportIssueDialog
      open
      handleClose={() => undefined}
      oystehr={undefined}
      patient={patient}
      appointment={appointment}
      encounter={encounter}
      locationId="location-1"
      setToastMessage={() => undefined}
      setToastType={() => undefined}
      setSnackbarOpen={() => undefined}
    />
  ),
});
