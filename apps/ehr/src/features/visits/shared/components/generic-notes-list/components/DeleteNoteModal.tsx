import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { EditableNote, NoteLocales } from '../types';

export const DeleteNoteModal: React.FC<{
  open: boolean;
  onClose: () => void;
  entity: EditableNote;
  onDelete: (entity: EditableNote) => Promise<void>;
  locales: NoteLocales;
}> = ({ open, onClose, entity, onDelete, locales }) => {
  return (
    <InPersonModal
      open={open}
      handleClose={onClose}
      entity={entity}
      handleConfirm={onDelete}
      title={locales.getDeleteModalTitle(locales.entityLabel)}
      description={locales.getDeleteModalContent(locales.entityLabel)}
      closeButtonText={locales.getKeepButtonText()}
      confirmText={locales.getDeleteButtonText(false)}
      errorMessage={locales.getErrorMessage('deletion', locales.entityLabel)}
      getEntityPreviewText={(note: EditableNote) => note.text}
    />
  );
};
