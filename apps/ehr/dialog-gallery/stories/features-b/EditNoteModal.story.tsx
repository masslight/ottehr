import { EditNoteModal } from 'src/features/patient-notes/components/EditNoteModal';
import { NoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { defineStory } from '../../harness/story';

const note: NoteDTO = {
  resourceId: 'note-1',
  patientId: 'patient-1',
  text: 'Patient prefers afternoon appointments. Mother (Karen) is the primary contact and should be called first.',
  authorId: 'practitioner-1',
  authorName: 'Dr. Olivia Bennett',
  sent: '2026-11-02T15:12:00.000Z',
};

export default defineStory({
  title: 'Edit patient note',
  source: 'apps/ehr/src/features/patient-notes/components/EditNoteModal.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Patient Notes dialog → pencil icon on a note',
  notes: 'Rendered directly with a mock note. Save is disabled until the text changes (normal initial state).',
  render: () => <EditNoteModal note={note} target={{ patientId: 'patient-1' }} onClose={() => undefined} />,
});
