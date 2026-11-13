import VisitDetailsPage from 'src/pages/VisitDetailsPage';
import { defineStory } from '../../harness/story';
import { VISIT_NOTES, VISIT_ROUTE, VISIT_ROUTE_PATH, visitDetailsMocks } from './_visitDetails';

export default defineStory({
  title: 'Move patient to next in queue',
  source: 'apps/ehr/src/pages/VisitDetailsPage.tsx',
  base: 'CustomDialog',
  kind: 'confirm',
  where: 'Visit details page (visit in "arrived" status) → "Move to next" button in the header',
  route: VISIT_ROUTE,
  routePath: VISIT_ROUTE_PATH,
  mocks: visitDetailsMocks,
  render: () => <VisitDetailsPage />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Move to next' }, { timeout: 20000 }));
    await screen.findByRole('dialog');
  },
  notes: VISIT_NOTES,
});
