import { defineStory } from '../../harness/story';
import { serviceCategoriesMocks, ServiceCategoriesPageWithHeaderSlot } from './_serviceCategories';

export default defineStory({
  title: 'Edit service (service category)',
  source: 'apps/ehr/src/pages/ServiceCategoriesAdminPage.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Services → click a row or its edit (pencil) icon',
  route: '/admin/services',
  mocks: serviceCategoriesMocks,
  render: () => <ServiceCategoriesPageWithHeaderSlot />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByText('Sports Physical', {}, { timeout: 10000 }));
    await screen.findByText('Edit Service');
  },
  notes: 'One admin-managed service returned by a mocked list zambda; dialog opened on that row.',
});
