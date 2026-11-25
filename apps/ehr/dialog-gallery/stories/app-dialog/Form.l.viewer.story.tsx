import DownloadIcon from '@mui/icons-material/Download';
import { Box } from '@mui/material';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'AppDialog · form, size L, used as a viewer',
  source: 'apps/ehr/src/components/dialogs/AppDialog.tsx',
  base: 'AppDialog',
  kind: 'viewer',
  where: 'New standard shell; content matches the Viewer mockup in the design proposal',
  notes: 'The document area is a grey placeholder standing in for the caller’s own content.',
  render: () => (
    <AppDialog
      variant="form"
      size="l"
      open
      onClose={() => undefined}
      title="Statement Preview"
      subtitle="Jordan Lee · Statement #ST-20931 · 3 pages"
      dismiss={{ label: 'Close' }}
      actions={[{ label: 'Download PDF', onClick: () => undefined, startIcon: <DownloadIcon /> }]}
      primary={{ label: 'Mail Statement', onClick: () => undefined }}
    >
      <Box sx={{ height: 420, borderRadius: 1, bgcolor: 'grey.100' }} />
    </AppDialog>
  ),
});
