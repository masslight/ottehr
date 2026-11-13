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
  {
    id: 'q-3',
    title: 'PHQ-9',
    status: 'active',
    url: 'https://example.com/q/phq-9',
    placement: 'screening',
    readOnly: false,
  },
];

export default defineStory({
  title: 'Send form to patient (send-only variant)',
  source: 'apps/ehr/src/components/dialogs/SendFormDialog.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Not currently reachable: every caller passes onFillOut',
  notes:
    'Variant rendered when onFillOut is omitted ("Send Form to Patient" title, no "Fill out now"). No current caller in apps/ehr/src omits onFillOut, so this variant is not reachable in the app today.',
  mocks: [
    {
      url: 'practice-managed-questionnaire-list',
      response: { status: 200, output: { practiceManagedQuestionnaires } },
    },
  ],
  setup: ({ queryClient }: { queryClient: QueryClient }) => {
    queryClient.setQueryData(['practice-managed-questionnaire-list'], { practiceManagedQuestionnaires });
  },
  render: () => <SendFormDialog open onClose={() => undefined} appointmentId="appt-1" placement="visit-details" />,
});
