import { DeleteNoteModal } from 'src/features/visits/shared/components/generic-notes-list/components/DeleteNoteModal';
import { defineStory } from '../../harness/story';
import { locales, note } from './EditNoteModal.story';

export default defineStory({
  title: 'Delete note',
  source: 'apps/ehr/src/features/visits/shared/components/generic-notes-list/components/DeleteNoteModal.tsx',
  base: 'InPersonModal',
  kind: 'destructive-confirm',
  where: 'Visit chart → any notes list (intake, internal, vitals, screening...) → delete icon on a note',
  render: () => (
    <DeleteNoteModal open onClose={() => undefined} entity={note} onDelete={async () => undefined} locales={locales} />
  ),
  notes:
    "Not in the original file list (uses the InPersonModal wrapper). Texts come from the caller's locales; shown with the intake-note strings.",
});
