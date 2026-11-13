import { ImportQuestionnaireJsonDialog } from 'src/features/visits/telemed/components/admin/questionnaires/components/ImportQuestionnaireJsonDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Import questionnaire JSON',
  source:
    'apps/ehr/src/features/visits/telemed/components/admin/questionnaires/components/ImportQuestionnaireJsonDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Questionnaires → Import JSON',
  render: () => <ImportQuestionnaireJsonDialog open onClose={() => undefined} onImported={() => undefined} />,
});
