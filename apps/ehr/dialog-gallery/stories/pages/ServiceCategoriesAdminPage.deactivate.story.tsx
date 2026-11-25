import { defineStory } from '../../harness/story';
import { serviceCategoriesMocks, ServiceCategoriesPageWithHeaderSlot } from './_serviceCategories';

export default defineStory({
  title: 'Deactivate service (service category)',
  source: 'apps/ehr/src/pages/ServiceCategoriesAdminPage.tsx',
  base: 'AppDialog',
  kind: 'destructive-confirm',
  where: 'Admin → Services → deactivate (trash) icon on an active, admin-managed row',
  route: '/admin/services',
  mocks: serviceCategoriesMocks,
  render: () => <ServiceCategoriesPageWithHeaderSlot />,
  play: async ({ user, screen }) => {
    await screen.findByText('Sports Physical', {}, { timeout: 10000 });
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    await screen.findByText('Deactivate Service Category?');
  },
  notes:
    'Raised with confirmDestructive(); it replaced a native window.confirm, so there is no "before" screenshot. One admin-managed service returned by a mocked list zambda.',
});
