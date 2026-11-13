import { NoteItem } from 'src/features/patient-notes/components/NoteItem';
import { defineStory } from '../../harness/story';
import { mockNotes } from './notes-mocks';

export default defineStory({
  title: 'Delete patient note',
  source: 'apps/ehr/src/features/patient-notes/components/NoteItem.tsx',
  base: 'InPersonModal',
  kind: 'destructive-confirm',
  where: 'Patient Notes dialog → trash icon on a note',
  notes:
    'Not in the original list (rendered through the InPersonModal wrapper, which wraps CustomDialog). A single NoteItem is rendered outside its NotesDialog parent, so only this confirm dialog is open.',
  render: () => <NoteItem note={mockNotes[0]} target={{ patientId: 'patient-1' }} />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'delete note' }));
    await screen.findByText(/This action cannot be undone/);
  },
});
