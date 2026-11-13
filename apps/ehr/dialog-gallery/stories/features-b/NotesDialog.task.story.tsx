import { TaskNotesDialog } from 'src/features/tasks/components/TaskNotesDialog';
import { defineStory } from '../../harness/story';
import { mockNotes } from './notes-mocks';

export default defineStory({
  title: 'Task internal notes',
  source: 'apps/ehr/src/features/patient-notes/components/NotesDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Tasks board → notes icon on a task row',
  notes:
    'Same NotesDialog component as "Patient notes", rendered through its task caller TaskNotesDialog (different title, labels and button text). Notes are mocked.',
  mocks: [
    {
      url: 'get-patient-notes',
      response: {
        status: 200,
        output: { notes: mockNotes.slice(0, 2).map((n) => ({ ...n, taskId: 'task-1' })), hasMore: false },
      },
    },
  ],
  render: () => <TaskNotesDialog taskId="task-1" onClose={() => undefined} onNoteCreated={() => undefined} />,
  play: async ({ screen }) => {
    await screen.findByText(/Patient prefers afternoon appointments/);
  },
});
