import { TextField } from '@mui/material';
import EditPatientInfoDialog from 'src/components/dialogs/EditPatientInfoDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'EditPatientInfoDialog (base wrapper)',
  source: 'apps/ehr/src/components/dialogs/EditPatientInfoDialog.tsx',
  base: 'EditPatientInfoDialog',
  kind: 'form',
  where: 'Shared wrapper (built on MUI Dialog + Paper); callers pass the title, the input element and the submit label',
  notes: 'The `input` slot is filled with a single placeholder TextField; real callers pass their own inputs.',
  render: () => (
    <EditPatientInfoDialog
      modalOpen
      title="Dialog title"
      onClose={() => undefined}
      onSubmit={async (e) => e.preventDefault()}
      submitButtonName="Save"
      loading={false}
      input={<TextField label="Field label" defaultValue="Field value" fullWidth />}
    />
  ),
});
