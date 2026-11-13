import type { Questionnaire } from 'fhir/r4b';
import { QuestionnaireTestDialog } from 'src/features/visits/telemed/components/admin/questionnaires/components/QuestionnaireTestDialog';
import { defineStory } from '../../harness/story';

const questionnaire: Questionnaire = {
  resourceType: 'Questionnaire',
  id: 'q-1',
  url: 'https://ottehr.com/FHIR/Questionnaire/work-injury-intake',
  version: '1.0.0',
  status: 'active',
  title: 'Work injury intake',
  item: [
    {
      linkId: 'injury-details-page',
      type: 'group',
      text: 'Injury details',
      item: [
        { linkId: 'injury-date', type: 'date', text: 'Date of injury', required: true },
        { linkId: 'injury-description', type: 'string', text: 'How did the injury happen?', required: true },
        {
          linkId: 'injury-at-work',
          type: 'choice',
          text: 'Did the injury happen at work?',
          answerOption: [{ valueString: 'Yes' }, { valueString: 'No' }],
        },
      ],
    },
    {
      linkId: 'employer-page',
      type: 'group',
      text: 'Employer',
      item: [
        { linkId: 'employer-name', type: 'string', text: 'Employer name' },
        { linkId: 'supervisor-name', type: 'string', text: 'Supervisor name' },
      ],
    },
  ],
};

export default defineStory({
  title: 'Test questionnaire (patient preview)',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/questionnaires/components/QuestionnaireTestDialog.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Admin → Questionnaires → builder / read-only view → Test',
  notes: 'Shown on page 1 of a two-page mock questionnaire.',
  render: () => <QuestionnaireTestDialog open onClose={() => undefined} questionnaire={questionnaire} />,
});
