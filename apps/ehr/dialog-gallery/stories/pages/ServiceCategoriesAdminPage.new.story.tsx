import { defineStory } from '../../harness/story';
import { serviceCategoriesMocks, ServiceCategoriesPageWithHeaderSlot } from './_serviceCategories';

export default defineStory({
  title: 'New service (service category)',
  source: 'apps/ehr/src/pages/ServiceCategoriesAdminPage.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Services → "New Service" button in the admin page header',
  route: '/admin/services',
  mocks: serviceCategoriesMocks,
  render: () => <ServiceCategoriesPageWithHeaderSlot />,
  play: async ({ user, screen }) => {
    await screen.findByText('Sports Physical', {}, { timeout: 10000 });
    await user.click(screen.getByRole('button', { name: 'New Service' }));
    await screen.findByRole('dialog');
  },
  notes:
    'Same Dialog as the edit story, in its empty create state. The required Abbreviation field renders in its error style while empty — that is the component\'s own initial state, not a triggered validation. The header slot the "New Service" button portals into is supplied by a bare AdminHeaderSlotProvider.',
});
