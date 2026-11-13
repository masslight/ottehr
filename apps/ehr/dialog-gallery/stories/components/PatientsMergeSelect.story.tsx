import { PatientsMergeSelect } from 'src/components/patients-merge/PatientsMergeSelect';
import { defineStory } from '../../harness/story';
import { bundleOf, patientA, patientB } from './_shared';

export default defineStory({
  title: 'Merge patients — select duplicates',
  source: 'apps/ehr/src/components/patients-merge/PatientsMergeSelect.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Patient record → merge patients, step 1 (component is not currently mounted by any page)',
  mocks: [{ url: /\/fhir\/Patient/, response: bundleOf([patientA, patientB]) }],
  render: () => (
    <PatientsMergeSelect
      open
      close={() => undefined}
      next={() => undefined}
      patientIds={[patientA.id as string, patientB.id as string]}
    />
  ),
  play: async ({ screen }) => {
    await screen.findByText('Olivia Bennett', { exact: false }, { timeout: 10000 });
  },
});
