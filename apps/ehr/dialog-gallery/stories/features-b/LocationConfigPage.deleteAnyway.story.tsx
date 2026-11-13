import LocationConfigPage from 'src/features/locations/LocationConfigPage';
import { RESOURCE_HAS_DEPENDENTS_ERROR } from 'utils/lib/types/errors';
import { defineStory } from '../../harness/story';
import { locationConfigMocks } from './location-mocks';

export default defineStory({
  title: 'Delete location — has dependents ("Delete anyway?")',
  source: 'apps/ehr/src/features/locations/LocationConfigPage.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where:
    'Admin → Locations → a location → "Delete location" → Delete, when the location still has schedules / provider roles / appointments',
  notes:
    'Same Dialog as "Delete location" in its escalated state: the mocked delete-location zambda answers with RESOURCE_HAS_DEPENDENTS (the real error object from utils), and the dialog shows that message.',
  route: '/admin/locations/location-1',
  routePath: '/admin/locations/:location-id',
  mocks: [
    ...locationConfigMocks,
    {
      url: 'delete-location',
      status: 409,
      response: RESOURCE_HAS_DEPENDENTS_ERROR({ schedules: 2, practitionerRoles: 5, appointments: 148 }),
    },
  ],
  render: () => <LocationConfigPage />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Delete location' }, { timeout: 10000 }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await screen.findByText('Delete anyway?');
  },
});
