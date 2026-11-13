import { defineStory } from '../../harness/story';
import { mergeDifferenceMocks, renderMergeDifference } from './_mergeDifference';

export default defineStory({
  title: 'Merge patients — confirm merge',
  source: 'apps/ehr/src/components/patients-merge/PatientsMergeDifference.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'Merge patients (compare step) → "Merge Patients"',
  mocks: mergeDifferenceMocks,
  render: renderMergeDifference,
  play: async ({ user, screen }) => {
    await screen.findByText('Main Patient Record', {}, { timeout: 15000 });
    await user.click(screen.getByRole('button', { name: 'Merge Patients' }));
  },
});
