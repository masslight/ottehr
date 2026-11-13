import { ExamCardCheckboxWithModalComponent } from 'config-types/config/examination';
import { ExamCheckboxWithModal } from 'src/features/visits/shared/components/exam-tab/ExamCheckboxWithModal';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { defineStory } from '../../harness/story';
import { visitMocks, visitRoute } from './_fixtures';

const FIELD = 'lymph-anterior-cervical';
const config = DefaultExamComponentsConfig['lymph'].components.abnormal[FIELD] as ExamCardCheckboxWithModalComponent;

export default defineStory({
  title: 'Exam finding details — Anterior cervical lymph nodes, left/right columns (maxWidth lg)',
  source: 'apps/ehr/src/features/visits/shared/components/exam-tab/ExamCheckboxWithModal.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Visit chart → Exam → pencil icon next to an abnormal finding that has detail options',
  ...visitRoute,
  mocks: visitMocks(),
  render: () => <ExamCheckboxWithModal name={FIELD} config={config} abnormal />,
  play: async ({ user, screen, waitFor }) => {
    await user.click(await waitFor(() => screen.getByTestId('EditOutlinedIcon')));
  },
  notes: 'Uses the real default exam config for "lymph-anterior-cervical"; nothing selected yet.',
});
