import { VitalsObservationDTO } from 'utils';
import { CSSModal } from '../CSSModal';

export const DeleteVitalModal: React.FC<{
  open: boolean;
  onClose: () => void;
  entity: VitalsObservationDTO;
  onDelete: (entity: VitalsObservationDTO) => Promise<void>;
}> = ({ open, onClose, entity, onDelete }) => {
  return (
    <CSSModal
      open={open}
      handleClose={onClose}
      entity={entity}
      handleConfirm={onDelete}
      title="Delete vital"
      description="Are you sure you want to permanently delete this vitals note?"
      closeButtonText="Keep"
      confirmText="Delete"
      errorMessage="Can't delete vital observation. Please try again later."
      showEntityPreview={false}
    />
  );
};
