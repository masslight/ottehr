import { defineStory } from '../../harness/story';
import { mergeDifferenceMocks, renderMergeDifference } from './_mergeDifference';

export default defineStory({
  title: 'Merge patients — compare records',
  source: 'apps/ehr/src/components/patients-merge/PatientsMergeDifference.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Patient record → duplicate-patient alert → Merge',
  mocks: mergeDifferenceMocks,
  notes: 'Shown in its default "Only Different Info" view for two mock patients without insurance coverage.',
  render: renderMergeDifference,
  play: async ({ screen }) => {
    await screen.findByText('Main Patient Record', {}, { timeout: 15000 });
  },
});
