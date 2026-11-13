import LocationsListPage from 'src/features/locations/LocationsListPage';
import { defineStory } from '../../harness/story';
import { fhirBundle, mockLocation } from './shared-mocks';

export default defineStory({
  title: 'Add location',
  source: 'apps/ehr/src/features/locations/LocationsListPage.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Locations → "Add location" button',
  notes: 'Opened via the real button; a name was typed so the Create button shows its enabled state.',
  route: '/admin/locations',
  mocks: [
    {
      url: /\/fhir\/Location\b/,
      response: fhirBundle([
        mockLocation,
        { ...mockLocation, id: 'location-2', name: 'Northside Clinic', status: 'inactive' },
      ]),
    },
  ],
  render: () => <LocationsListPage />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Add location' }));
    await user.type(await screen.findByLabelText('Name'), 'Riverside Pediatrics');
  },
});
