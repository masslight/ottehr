import { ImportQuestionnaireJsonDialog } from 'src/features/visits/telemed/components/admin/questionnaires/components/ImportQuestionnaireJsonDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Upload new questionnaire version',
  source:
    'apps/ehr/src/features/visits/telemed/components/admin/questionnaires/components/ImportQuestionnaireJsonDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Questionnaires → imported questionnaire detail → Upload New Version',
  notes: 'Same dialog as the import story, in its "existingQuestionnaire" mode (different title, info alert, button).',
  render: () => (
    <ImportQuestionnaireJsonDialog
      open
      onClose={() => undefined}
      onImported={() => undefined}
      existingQuestionnaire={{
        id: 'q-1',
        url: 'https://ottehr.com/FHIR/Questionnaire/work-injury-intake',
        version: '1.2.0',
      }}
    />
  ),
});
