import { ClearChartSectionButton } from 'src/features/visits/shared/components/ClearChartSectionButton';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Clear chart section (Clear ROS)',
  source: 'apps/ehr/src/features/visits/shared/components/ClearChartSectionButton.tsx',
  base: 'AppDialog',
  kind: 'destructive-confirm',
  where: 'Visit chart → Review of Systems page title → "Clear ROS" button',
  render: () => <ClearChartSectionButton label="Clear ROS" sectionName="Review of Systems" onClear={() => undefined} />,
  play: async ({ user, screen }) => {
    await user.click(screen.getByRole('button', { name: 'Clear ROS' }));
  },
  notes: 'Variant of ClearChartSectionButton with the values the ROS page passes (ClearRosButton.tsx).',
});
