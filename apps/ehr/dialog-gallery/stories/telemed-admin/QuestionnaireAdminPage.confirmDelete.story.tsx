import { QuestionnaireAdminPage } from 'src/features/visits/telemed/components/admin/questionnaires/QuestionnaireAdminPage';
import { defineStory } from '../../harness/story';
import { zambda } from './_mocks';

export default defineStory({
  title: 'Delete questionnaire',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/questionnaires/QuestionnaireAdminPage.tsx',
  base: 'AppDialog',
  kind: 'destructive-confirm',
  where: 'Admin → Questionnaires → delete icon on a row',
  notes: 'Replaces a native window.confirm(), so there is no "before" screenshot.',
  mocks: [
    zambda('practice-managed-questionnaire-list', {
      practiceManagedQuestionnaires: [
        {
          id: 'q-1',
          title: 'Work injury intake',
          status: 'active',
          url: 'https://ottehr.com/FHIR/Questionnaire/work-injury-intake',
          placement: 'visit-details',
          readOnly: false,
        },
        {
          id: 'q-2',
          title: 'Sports physical',
          status: 'active',
          url: 'https://ottehr.com/FHIR/Questionnaire/sports-physical',
          placement: 'visit-details',
          readOnly: false,
        },
      ],
    }),
  ],
  render: () => <QuestionnaireAdminPage />,
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByRole('button', { name: 'Delete' }))[0]);
    await screen.findByRole('dialog');
  },
});
