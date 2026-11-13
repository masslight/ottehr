import { ApplyTemplate } from 'src/features/visits/shared/components/templates/ApplyTemplate';
import { defineStory } from '../../harness/story';
import { templateListMock } from './_templates';
import { visitMocks, visitRoute } from './_visit';

export default defineStory({
  title: 'Update existing template? (overwrite confirmation)',
  source: 'apps/ehr/src/features/visits/shared/components/templates/ApplyTemplate.tsx',
  base: 'MUI Dialog',
  kind: 'confirm',
  where: 'Visit → template picker → "+ Add or Update Template From Note" → Save with a name that already exists',
  ...visitRoute,
  mocks: visitMocks({ roles: ['Provider', 'Administrator'], extra: [templateListMock] }),
  notes:
    'Second state of the same <Dialog> as "Save note as template", reached through the real flow: type an existing template name, click Save.',
  render: () => <ApplyTemplate />,
  play: async ({ user, screen }) => {
    const input = await screen.findByLabelText('Select condition');
    await screen.findByPlaceholderText('Search templates...', undefined, { timeout: 10000 });
    await user.click(input);
    await user.click(await screen.findByText('+ Add or Update Template From Note', undefined, { timeout: 10000 }));
    await user.type(await screen.findByLabelText(/Template name/), 'Strep Pharyngitis');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Update Existing Template?');
  },
});
