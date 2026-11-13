import { Tasks } from 'src/features/tasks/pages/Tasks';
import { defineStory } from '../../harness/story';
import { faxTaskMocks, userMocks } from './shared-mocks';

export default defineStory({
  title: 'Complete inbound-fax task without filing',
  source: 'apps/ehr/src/features/tasks/pages/Tasks.tsx',
  base: 'ConfirmationDialog',
  kind: 'confirm',
  where: 'Tasks board → "Complete" on an unfiled inbound-fax task assigned to you',
  notes:
    'Tasks page rendered with one mocked FHIR fax Task assigned to the mocked signed-in practitioner; opened via the real Complete button.',
  route: '/tasks?status=ready,in-progress',
  setup: () => {
    try {
      localStorage.removeItem('tasks.filters');
    } catch {
      // ignore
    }
  },
  mocks: [...userMocks, ...faxTaskMocks],
  render: () => <Tasks />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Complete' }, { timeout: 10000 }));
    await screen.findByText('Complete without filing?');
  },
});
