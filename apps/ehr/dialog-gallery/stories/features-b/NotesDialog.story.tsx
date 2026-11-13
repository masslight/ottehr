import { PatientNotesButton } from 'src/features/patient-notes/components/PatientNotesButton';
import { defineStory } from '../../harness/story';
import { notesMocks } from './notes-mocks';

export default defineStory({
  title: 'Patient notes',
  source: 'apps/ehr/src/features/patient-notes/components/NotesDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Chart header / patient page → patient notes button (note icon with count)',
  notes: 'Opened through the real PatientNotesButton; notes list comes from a mocked get-patient-notes zambda.',
  mocks: notesMocks,
  render: () => <PatientNotesButton patientId="patient-1" />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: /Patient notes \(3\)/ }));
    await screen.findByText('Needs Spanish interpreter for in-person visits.');
  },
});
