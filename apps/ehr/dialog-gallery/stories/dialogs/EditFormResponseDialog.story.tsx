import { EditFormResponseDialog } from 'src/components/dialogs/EditFormResponseDialog';
import type { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { defineStory } from '../../harness/story';

const question = (
  linkId: string,
  text: string,
  type: 'string' | 'text' = 'string'
): StandaloneFormDTO['allItems'][number] => ({
  linkId,
  text,
  type,
  acceptsMultipleAnswers: false,
  alwaysFilter: false,
});

const form: StandaloneFormDTO = {
  questionnaireId: 'work-status',
  questionnaireTitle: 'Work Status Form',
  allItems: [
    {
      linkId: 'page-one',
      type: 'group',
      acceptsMultipleAnswers: false,
      alwaysFilter: false,
      item: [
        question('employer', 'Employer name'),
        question('job-title', 'Job title'),
        question('restrictions', 'Work restrictions', 'text'),
      ],
    },
  ],
  questionnaireResponse: {
    resourceType: 'QuestionnaireResponse',
    id: 'qr-1',
    status: 'completed',
    item: [
      {
        linkId: 'page-one',
        item: [
          { linkId: 'employer', answer: [{ valueString: 'Acme Logistics' }] },
          { linkId: 'job-title', answer: [{ valueString: 'Warehouse associate' }] },
          { linkId: 'restrictions', answer: [{ valueString: 'No lifting over 20 lbs for two weeks.' }] },
        ],
      },
    ],
  },
};

export default defineStory({
  title: 'Edit form response',
  source: 'apps/ehr/src/components/dialogs/EditFormResponseDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Visit details page / patient forms card → edit a submitted form',
  notes:
    'Mock three-question practice-managed form with submitted answers; body is the shared PagedQuestionnaire (patient-paperwork inputs). Untouched, so Save is disabled.',
  render: () => (
    <EditFormResponseDialog form={form} patientId="patient-1" onClose={() => undefined} onSaved={() => undefined} />
  ),
  play: async ({ screen }) => {
    await screen.findByDisplayValue('Acme Logistics');
  },
});
