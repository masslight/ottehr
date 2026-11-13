import OutreachTasksReport from 'src/rcm/features/scheduled-patient-outreach/OutreachTasksReport';
import { defineStory } from '../../harness/story';
import { communicationsMock, outreachMocks, outreachPaperMail } from './_outreach';

export default defineStory({
  title: 'Outreach paper statements history',
  source: 'apps/ehr/src/rcm/features/scheduled-patient-outreach/OutreachTasksReport.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Admin → Outreach → Patient outreach → Outreach Tracker → task row → paper mail history button',
  notes: 'Real OutreachTasksReport with mocked task list; history content is mocked (FHIR Communication search).',
  mocks: [...outreachMocks, communicationsMock(outreachPaperMail)],
  render: () => <OutreachTasksReport />,
  play: async ({ user, screen }) => {
    const icon = (await screen.findAllByTestId('DescriptionOutlinedIcon'))[0];
    await user.click(icon.closest('button') as HTMLElement);
    await screen.findAllByText(/Final notice statement mailed/);
  },
});
