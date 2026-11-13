import { ExamCardCheckboxWithModalComponent } from 'config-types/config/examination';
import { ExamCheckboxWithModal } from 'src/features/visits/shared/components/exam-tab/ExamCheckboxWithModal';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { defineStory } from '../../harness/story';
import { visitMocks, visitRoute } from './_fixtures';

const FIELD = 'common-skin-findings';
const config = DefaultExamComponentsConfig['skin'].components.abnormal[FIELD] as ExamCardCheckboxWithModalComponent;

export default defineStory({
  title: 'Exam finding details — Common skin findings, options with descriptions (shows the italic hint line)',
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
  notes: 'Uses the real default exam config for "common-skin-findings"; nothing selected yet.',
});
