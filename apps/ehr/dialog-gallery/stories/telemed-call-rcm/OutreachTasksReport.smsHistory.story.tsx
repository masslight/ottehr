import OutreachTasksReport from 'src/rcm/features/scheduled-patient-outreach/OutreachTasksReport';
import { defineStory } from '../../harness/story';
import { outreachMocks } from './_outreach';

export default defineStory({
  title: 'Outreach SMS history',
  source: 'apps/ehr/src/rcm/features/scheduled-patient-outreach/OutreachTasksReport.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Admin → Outreach → Patient outreach → Outreach Tracker → task row → SMS history button',
  notes: 'Real OutreachTasksReport with mocked task list; history content is mocked (get-conversation zambda).',
  mocks: outreachMocks,
  render: () => <OutreachTasksReport />,
  play: async ({ user, screen }) => {
    const icon = (await screen.findAllByTestId('ChatOutlinedIcon'))[0];
    await user.click(icon.closest('button') as HTMLElement);
    await screen.findAllByText(/pay half now/);
  },
});
