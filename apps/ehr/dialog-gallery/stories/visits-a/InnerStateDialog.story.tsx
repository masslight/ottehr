import { Button } from '@mui/material';
import { InnerStateDialog } from 'src/features/visits/shared/components/InnerStateDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'InnerStateDialog (base, default props)',
  source: 'apps/ehr/src/features/visits/shared/components/InnerStateDialog.tsx',
  base: 'InnerStateDialog',
  kind: 'other',
  where: 'Shared base component (wrapped by ConfirmationDialog and used directly by a few callers)',
  render: () => (
    <InnerStateDialog
      title="Dialog title"
      content="Body text passed as plain content."
      actions={(hideDialog) => (
        <>
          <Button onClick={hideDialog}>Cancel</Button>
          <Button variant="contained" onClick={hideDialog}>
            Confirm
          </Button>
        </>
      )}
    >
      {(showDialog) => <Button onClick={showDialog}>open</Button>}
    </InnerStateDialog>
  ),
  // Opened by its own trigger rather than an `open` prop.
  play: async ({ user, screen }) => {
    await user.click(screen.getByRole('button', { name: 'open' }));
  },
  notes:
    'The wrapper has no buttons of its own; the two MUI Buttons in the actions slot are placeholder children supplied by the story.',
});
