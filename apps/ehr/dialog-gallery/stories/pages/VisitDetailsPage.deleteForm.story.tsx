import VisitDetailsPage from 'src/pages/VisitDetailsPage';
import { defineStory } from '../../harness/story';
import { VISIT_NOTES, VISIT_ROUTE, VISIT_ROUTE_PATH, visitDetailsMocks } from './_visitDetails';

export default defineStory({
  title: 'Delete custom form from visit',
  source: 'apps/ehr/src/pages/VisitDetailsPage.tsx',
  base: 'DeleteDialog',
  kind: 'destructive-confirm',
  where: 'Visit details page → custom form card → ⋮ menu → Delete',
  route: VISIT_ROUTE,
  routePath: VISIT_ROUTE_PATH,
  mocks: visitDetailsMocks,
  render: () => <VisitDetailsPage />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByTestId('custom-form-menu-button-questionnaire-1', {}, { timeout: 20000 }));
    await user.click(await screen.findByTestId('custom-form-delete-menu-item'));
    await screen.findByText('Delete form?');
  },
  notes: VISIT_NOTES,
});
