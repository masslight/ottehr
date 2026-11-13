import { defineStory } from '../../harness/story';
import { mockPatientAccounts, renderMergeDifference } from './_mergeDifference';

export default defineStory({
  title: 'Merge patients — confirm merge',
  source: 'apps/ehr/src/components/patients-merge/PatientsMergeDifference.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'Merge patients (compare step) → "Merge Patients"',
  setup: mockPatientAccounts,
  render: renderMergeDifference,
  play: async ({ user, screen }) => {
    await screen.findByText('Olivia Grace', {}, { timeout: 15000 });
    await user.click(screen.getByRole('button', { name: 'Merge Patients' }));
  },
});
