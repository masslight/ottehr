import { InboundFaxMatch } from 'src/features/inbound-fax/pages/InboundFaxMatch';
import { defineStory } from '../../harness/story';
import { faxTaskMocks, userMocks } from './shared-mocks';

export default defineStory({
  title: 'Delete inbound fax',
  source: 'apps/ehr/src/features/inbound-fax/pages/InboundFaxMatch.tsx',
  base: 'ConfirmationDialog',
  kind: 'destructive-confirm',
  where: 'Tasks board → "Match" on an inbound-fax task → Match Inbound Fax page → "Delete"',
  notes:
    'Page rendered with a mocked FHIR fax Task (sender, page count, received date feed the dialog text); the PDF preview behind the dialog is a blank frame.',
  route: '/inbound-fax/comm-1/match',
  routePath: '/inbound-fax/:communicationId/match',
  mocks: [...userMocks, ...faxTaskMocks],
  render: () => <InboundFaxMatch />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Delete' }, { timeout: 10000 }));
    await screen.findByText('Delete inbound fax?');
  },
});
