import { defineStory } from '../../harness/story';
import { practitionerRoleListMocks, renderPractitionerRoleList } from './_practitionerRoleList';

export default defineStory({
  title: 'Rename schedule',
  source: 'apps/ehr/src/components/schedule/PractitionerRoleList.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Employees → edit employee → Schedules → rename icon',
  mocks: practitionerRoleListMocks,
  render: renderPractitionerRoleList,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Rename schedule' }, { timeout: 10000 }));
  },
});
