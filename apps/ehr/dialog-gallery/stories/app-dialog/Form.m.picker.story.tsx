import { Checkbox, List, ListItemButton, ListItemText, TextField } from '@mui/material';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { defineStory } from '../../harness/story';

const sets = [
  ['Basic metabolic panel', '8 tests · LabCorp', true],
  ['Lipid panel', '4 tests · LabCorp', true],
  ['Comprehensive metabolic panel', '14 tests · Quest', false],
  ['CBC with differential', '1 test · Quest', false],
] as const;

export default defineStory({
  title: 'AppDialog · form, size M, used as a picker',
  source: 'apps/ehr/src/components/dialogs/AppDialog.tsx',
  base: 'AppDialog',
  kind: 'picker',
  where: 'New standard shell; content matches the Picker mockup in the design proposal',
  notes: 'The search field and list are the caller’s own content, not part of the shell.',
  render: () => (
    <AppDialog
      variant="form"
      size="m"
      open
      onClose={() => undefined}
      title="Add Lab Set"
      footerNote="2 selected"
      primary={{ label: 'Add 2 Lab Sets', onClick: () => undefined }}
    >
      <TextField placeholder="Search lab sets" size="small" fullWidth />
      <List dense>
        {sets.map(([name, detail, checked]) => (
          <ListItemButton key={name} disableGutters>
            <Checkbox checked={checked} size="small" />
            <ListItemText primary={name} secondary={detail} />
          </ListItemButton>
        ))}
      </List>
    </AppDialog>
  ),
});
