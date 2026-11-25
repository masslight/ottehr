import PaperworkFlowsAdminPage from 'src/features/visits/telemed/components/admin/paperwork-flows/PaperworkFlowsAdminPage';
import { ServiceMode } from 'utils/lib/types/common';
import { defineStory } from '../../harness/story';
import { flowForms, flowServices } from './_flows';
import { zambda } from './_mocks';

export default defineStory({
  title: 'Delete paperwork flow',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/paperwork-flows/PaperworkFlowsAdminPage.tsx',
  base: 'AppDialog',
  kind: 'destructive-confirm',
  where: 'Admin → Paperwork Flows → delete icon on a row',
  notes: 'Replaces a native window.confirm(), so there is no "before" screenshot.',
  mocks: [
    zambda('paperwork-flow-list', {
      flows: [
        {
          qId: 'flow-1',
          name: 'Occupational medicine intake',
          forms: flowForms.slice(0, 2),
          modes: [ServiceMode['in-person']],
          services: flowServices.slice(0, 2),
        },
        {
          qId: 'flow-2',
          name: 'Urgent care intake',
          forms: flowForms.slice(0, 1),
          modes: [ServiceMode['in-person'], ServiceMode.virtual],
          services: flowServices.slice(2),
        },
      ],
      ottehrManagedQuestionnaires: flowForms.slice(0, 1),
    }),
    zambda('practice-managed-questionnaire-list', { practiceManagedQuestionnaires: [] }),
    zambda('admin-list-service-categories', { serviceCategories: [] }),
  ],
  render: () => <PaperworkFlowsAdminPage />,
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByRole('button', { name: 'Delete' }))[0]);
    await screen.findByRole('dialog');
  },
});
