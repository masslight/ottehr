import { PatientsMergeSelect } from 'src/components/patients-merge/PatientsMergeSelect';
import { defineStory } from '../../harness/story';
import { bundleOf, patientA, patientB } from './_shared';

export default defineStory({
  title: 'Merge patients — mark as not duplicates',
  source: 'apps/ehr/src/components/patients-merge/PatientsMergeSelect.tsx',
  base: 'ConfirmationDialog',
  kind: 'destructive-confirm',
  where: 'Merge patients (select step) → "Mark all as not duplicates" (component is not currently mounted by any page)',
  mocks: [{ url: /\/fhir\/Patient/, response: bundleOf([patientA, patientB]) }],
  render: () => (
    <PatientsMergeSelect
      open
      close={() => undefined}
      next={() => undefined}
      patientIds={[patientA.id as string, patientB.id as string]}
    />
  ),
  play: async ({ user, screen }) => {
    await screen.findByText('Olivia Bennett', { exact: false }, { timeout: 10000 });
    await user.click(screen.getByRole('button', { name: 'Mark all as not duplicates' }));
  },
});
