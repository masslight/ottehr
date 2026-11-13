import LogoutWarning from 'src/components/dialogs/LogoutWarning';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Session about to expire (inactivity logout warning)',
  source: 'apps/ehr/src/components/dialogs/LogoutWarning.tsx',
  base: 'MUI Dialog',
  kind: 'confirm',
  where: 'App-wide, shown after a period of inactivity',
  notes:
    'Live countdown; a long timeout (600s) is passed so the dialog does not end during capture, so the number shown is ~599.',
  render: () => <LogoutWarning modalOpen onEnd={() => undefined} onContinue={() => undefined} timeoutInSeconds={600} />,
});
