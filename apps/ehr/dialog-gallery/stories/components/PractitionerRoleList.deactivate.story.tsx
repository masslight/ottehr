import { defineStory } from '../../harness/story';
import { practitionerRoleListMocks, renderPractitionerRoleList } from './_practitionerRoleList';

export default defineStory({
  title: 'Deactivate schedule?',
  source: 'apps/ehr/src/components/schedule/PractitionerRoleList.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'Admin → Employees → edit employee → Schedules → switch the Active toggle off',
  mocks: practitionerRoleListMocks,
  render: renderPractitionerRoleList,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('checkbox', { name: 'Deactivate schedule' }, { timeout: 10000 }));
  },
});
