import LocationAssociations from 'src/features/visits/telemed/components/admin/charge-items/LocationAssociations';
import { defineStory } from '../../harness/story';
import { feeSchedule, locations } from './_mocks';

export default defineStory({
  title: 'Associate locations with a fee schedule',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/charge-items/LocationAssociations.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Admin → Billing → Fee Schedules / Charge Masters → an entry → Location Associations tab → Add location',
  notes: 'Rendered in fee-schedule mode; charge-master mode only changes the words "fee schedule" in the body text.',
  mocks: [
    {
      url: /\/Location/,
      response: { resourceType: 'Bundle', type: 'searchset', entry: locations.map((resource) => ({ resource })) },
    },
  ],
  render: () => <LocationAssociations feeSchedule={feeSchedule} isFetching={false} />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Add location' }));
    await screen.findByText('Eastside Clinic');
  },
});
