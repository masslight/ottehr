import { NoteItem } from 'src/features/patient-notes/components/NoteItem';
import { defineStory } from '../../harness/story';
import { mockNotes } from './notes-mocks';

export default defineStory({
  title: 'Delete task note',
  source: 'apps/ehr/src/features/patient-notes/components/NoteItem.tsx',
  base: 'AppDialog',
  kind: 'destructive-confirm',
  where: 'Tasks board → task notes dialog → trash icon on a note',
  notes: 'A single NoteItem is rendered outside its NotesDialog parent, so only this confirm dialog is open.',
  render: () => <NoteItem note={mockNotes[0]} target={{ taskId: 'task-1' }} />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'delete note' }));
    await screen.findByText(/This action cannot be undone/);
  },
});
