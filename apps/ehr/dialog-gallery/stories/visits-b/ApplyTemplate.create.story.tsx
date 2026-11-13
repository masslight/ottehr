import { ApplyTemplate } from 'src/features/visits/shared/components/templates/ApplyTemplate';
import { defineStory } from '../../harness/story';
import { templateListMock } from './_templates';
import { visitMocks, visitRoute } from './_visit';

export default defineStory({
  title: 'Save note as template',
  source: 'apps/ehr/src/features/visits/shared/components/templates/ApplyTemplate.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Visit → template picker ("Select condition") → "+ Add or Update Template From Note" (admins only)',
  ...visitRoute,
  mocks: visitMocks({ roles: ['Provider', 'Administrator'], extra: [templateListMock] }),
  notes:
    'Signed-in mock user has the Administrator role (the option is disabled otherwise). Name field starts empty, as in the product.',
  render: () => <ApplyTemplate />,
  play: async ({ user, screen }) => {
    const input = await screen.findByLabelText('Select condition');
    await screen.findByPlaceholderText('Search templates...', undefined, { timeout: 10000 });
    await user.click(input);
    await user.click(await screen.findByText('+ Add or Update Template From Note', undefined, { timeout: 10000 }));
    await screen.findByText('Save Note As Template');
  },
});
