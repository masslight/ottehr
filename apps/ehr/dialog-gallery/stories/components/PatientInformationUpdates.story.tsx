import { PatientInformationUpdates } from 'src/components/patients-merge/PatientInformationUpdates';
import { defineStory } from '../../harness/story';
import { bundleOf, patientA } from './_shared';

const task = {
  resourceType: 'Task',
  id: 'task-1',
  status: 'ready',
  intent: 'order',
  requester: { reference: `Patient/${patientA.id}` },
  input: [
    {
      type: { text: 'patch' },
      valueString: JSON.stringify({ op: 'replace', path: '/name/0/given/0', value: 'Olivia Grace' }),
    },
    {
      type: { text: 'patch' },
      valueString: JSON.stringify({ op: 'replace', path: '/name/0/family', value: 'Bennet' }),
    },
    { type: { text: 'patch' }, valueString: JSON.stringify({ op: 'replace', path: '/gender', value: 'other' }) },
    {
      type: { text: 'patch' },
      valueString: JSON.stringify({ op: 'replace', path: '/contact/0/telecom/0/value', value: '+12125550199' }),
    },
  ],
};

export default defineStory({
  title: 'Review patient information updates',
  source: 'apps/ehr/src/components/patients-merge/PatientInformationUpdates.tsx',
  base: 'InnerStateDialog',
  kind: 'form',
  where: 'Patient record → "Patient information updates" button (component is not currently mounted by any page)',
  mocks: [{ url: /\/fhir\/Patient/, response: bundleOf([patientA, task]) }],
  render: () => <PatientInformationUpdates patientId={patientA.id} />,
  play: async ({ user, screen }) => {
    // Let the patient + update task load before opening, so the table is populated.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await user.click(screen.getByRole('button', { name: 'Patient information updates' }));
    await screen.findByText('First Name', {}, { timeout: 10000 });
  },
});
