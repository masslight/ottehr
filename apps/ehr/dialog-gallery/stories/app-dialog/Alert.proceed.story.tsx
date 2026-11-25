import { Box } from '@mui/material';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'AppDialog · alert the user can proceed past',
  source: 'apps/ehr/src/components/dialogs/AppDialog.tsx',
  base: 'AppDialog',
  kind: 'info',
  where: 'New standard shell; content matches the Alert mockup in the design proposal, at the fixed XS width',
  notes: 'The callout is the caller’s own content, not part of the shell.',
  render: () => (
    <AppDialog
      variant="alert"
      open
      onClose={() => undefined}
      title="Abnormal Vital Values"
      dismiss={{ label: 'Back to Vitals' }}
      primary={{ label: 'Leave Anyway', onClick: () => undefined }}
    >
      <Box sx={{ mb: 1.5 }}>2 values are outside the normal range.</Box>
      <Box sx={{ p: '10px 12px', mb: 1.5, borderRadius: 1, bgcolor: '#fff4e5', color: '#663c00' }}>
        BP 182/114 mmHg
        <br />
        SpO₂ 89%
      </Box>
      Review them before leaving the vitals page.
    </AppDialog>
  ),
});
