import { Stack, TextField } from '@mui/material';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'AppDialog · form, size S',
  source: 'apps/ehr/src/components/dialogs/AppDialog.tsx',
  base: 'AppDialog',
  kind: 'form',
  where: 'New standard shell; content matches the Form S mockup in the design proposal',
  notes: 'The fields are the caller’s own content, not part of the shell.',
  render: () => (
    <AppDialog
      variant="form"
      size="s"
      open
      onClose={() => undefined}
      title="Edit Employer"
      subtitle="Changes apply to future visits only"
      onSubmit={(event) => event.preventDefault()}
      primary={{ label: 'Save' }}
      actions={[{ label: 'Delete Employer', onClick: () => undefined, tone: 'error' }]}
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <TextField label="Employer name" defaultValue="Northwind Logistics" size="small" fullWidth />
        <TextField label="Phone" defaultValue="(555) 014-2290" size="small" fullWidth />
        <TextField
          label="Notes"
          defaultValue="Occupational health contact: J. Rivera"
          size="small"
          fullWidth
          multiline
          minRows={3}
        />
      </Stack>
    </AppDialog>
  ),
});
