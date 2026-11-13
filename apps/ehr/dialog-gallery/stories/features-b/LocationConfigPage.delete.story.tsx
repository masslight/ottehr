import LocationConfigPage from 'src/features/locations/LocationConfigPage';
import { defineStory } from '../../harness/story';
import { locationConfigMocks } from './location-mocks';

export default defineStory({
  title: 'Delete location',
  source: 'apps/ehr/src/features/locations/LocationConfigPage.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'Admin → Locations → a location → Danger zone → "Delete location" (Administrator / Customer Support only)',
  notes: 'First-level confirmation. Signed-in user mocked as Administrator; location comes from a mocked get-location.',
  route: '/admin/locations/location-1',
  routePath: '/admin/locations/:location-id',
  mocks: locationConfigMocks,
  render: () => <LocationConfigPage />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Delete location' }, { timeout: 10000 }));
    await screen.findByText('Delete this location?');
  },
});
