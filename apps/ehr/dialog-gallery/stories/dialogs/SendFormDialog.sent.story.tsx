import type { QueryClient } from '@tanstack/react-query';
import { SendFormDialog } from 'src/components/dialogs/SendFormDialog';
import type { PracticeManagedQuestionnaireDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { defineStory } from '../../harness/story';

const practiceManagedQuestionnaires: PracticeManagedQuestionnaireDTO[] = [
  {
    id: 'q-1',
    title: 'Work Status Form',
    status: 'active',
    url: 'https://example.com/q/work-status',
    placement: 'visit-details',
    readOnly: false,
  },
  {
    id: 'q-2',
    title: 'School Excuse Note Request',
    status: 'active',
    url: 'https://example.com/q/school-note',
    placement: 'visit-details',
    readOnly: false,
  },
];

export default defineStory({
  title: 'Add form — after the link was sent',
  source: 'apps/ehr/src/components/dialogs/SendFormDialog.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Visit details page / patient forms card → "Add form" → pick a form → "Send via SMS"',
  notes:
    'Second step of the same dialog: once the link is sent the footer is a single Close button (and, when the patient app URL is configured, the form link is shown with a copy button). The send call is mocked.',
  mocks: [
    {
      url: 'practice-managed-questionnaire-list',
      response: { status: 200, output: { practiceManagedQuestionnaires } },
    },
    {
      url: 'send-patient-form',
      response: { status: 200, output: { questionnaireResponseId: '3c1f9a52-8d47-4f0b-9a3e-5b7d2e6c1a90' } },
    },
  ],
  setup: ({ queryClient }: { queryClient: QueryClient }) => {
    queryClient.setQueryData(['practice-managed-questionnaire-list'], { practiceManagedQuestionnaires });
  },
  render: () => (
    <SendFormDialog
      open
      onClose={() => undefined}
      appointmentId="appt-1"
      placement="visit-details"
      onFillOut={() => undefined}
    />
  ),
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('combobox', { name: 'Form' }));
    await user.click(await screen.findByRole('option', { name: 'Work Status Form' }));
    await user.click(screen.getByRole('button', { name: 'Send via SMS' }));
    await screen.findByRole('button', { name: 'Close' });
  },
});
