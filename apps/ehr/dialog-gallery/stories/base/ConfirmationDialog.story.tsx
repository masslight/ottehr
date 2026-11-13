import { Button } from '@mui/material';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'ConfirmationDialog (base, default props)',
  source: 'apps/ehr/src/components/ConfirmationDialog.tsx',
  base: 'ConfirmationDialog',
  kind: 'confirm',
  where: 'Shared base component (wraps InnerStateDialog)',
  render: () => (
    <ConfirmationDialog
      title="Dialog title"
      description="Body text passed as a plain string description."
      response={() => undefined}
      actionButtons={{ proceed: { text: 'Confirm' }, back: { text: 'Cancel' } }}
    >
      {(showDialog) => <Button onClick={showDialog}>open</Button>}
    </ConfirmationDialog>
  ),
  // Opened by its own trigger rather than an `open` prop.
  play: async ({ user, screen }) => {
    await user.click(screen.getByRole('button', { name: 'open' }));
  },
});
