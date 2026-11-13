import { ClearChartSectionButton } from 'src/features/visits/shared/components/ClearChartSectionButton';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Clear chart section (Clear Exam)',
  source: 'apps/ehr/src/features/visits/shared/components/ClearChartSectionButton.tsx',
  base: 'ConfirmationDialog',
  kind: 'destructive-confirm',
  where: 'Visit chart → Exam / ROS page title → "Clear Exam" / "Clear ROS" button',
  render: () => <ClearChartSectionButton label="Clear Exam" sectionName="Exam" onClear={() => undefined} />,
  play: async ({ user, screen }) => {
    await user.click(screen.getByRole('button', { name: 'Clear Exam' }));
  },
  notes: 'Label and section name are caller-supplied; shown with the Exam page values.',
});
