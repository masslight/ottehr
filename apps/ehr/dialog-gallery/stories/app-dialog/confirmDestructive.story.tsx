import { Button } from '@mui/material';
import { confirmDestructive } from 'src/components/dialogs/confirmDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'confirmDestructive() helper',
  source: 'apps/ehr/src/components/dialogs/confirmDialog.ts',
  base: 'AppDialog',
  kind: 'destructive-confirm',
  where: 'New imperative helper that replaces window.confirm()',
  render: () => (
    <>
      <Button
        onClick={() =>
          void confirmDestructive({
            title: 'Delete Quick Pick?',
            body: '“Wrist splint” will be removed for everyone. This can’t be undone.',
            confirmLabel: 'Delete Quick Pick',
          })
        }
      >
        open
      </Button>
    </>
  ),
  play: async ({ user, screen }) => {
    await user.click(screen.getByRole('button', { name: 'open' }));
  },
});
