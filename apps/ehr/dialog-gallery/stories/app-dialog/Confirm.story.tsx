import { AppDialog } from 'src/components/dialogs/AppDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'AppDialog · confirm',
  source: 'apps/ehr/src/components/dialogs/AppDialog.tsx',
  base: 'AppDialog',
  kind: 'confirm',
  where: 'New standard shell; content matches the Confirm mockup in the design proposal',
  render: () => (
    <AppDialog
      variant="confirm"
      open
      onClose={() => undefined}
      title="Send Statement by Mail?"
      primary={{ label: 'Send by Mail', onClick: () => undefined }}
    >
      A paper statement for $184.20 will be mailed to 42 Elm St, Springfield. Mailing takes 3–5 business days.
    </AppDialog>
  ),
});
