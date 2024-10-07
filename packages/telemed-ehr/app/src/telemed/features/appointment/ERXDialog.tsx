import { Dialog } from '@mui/material';
import { ReactElement } from 'react';

export const ERXDialog = ({
  onClose,
  patientPhotonId,
}: {
  onClose: () => void;
  patientPhotonId?: string;
}): ReactElement => {
  return (
    <Dialog
      open={true}
      onClose={onClose}
      fullWidth
      disablePortal={true}
      disableScrollLock
      sx={{
        '.MuiPaper-root': {
          maxWidth: '500px',
        },
      }}
    >
      <photon-prescribe-workflow patient-id={patientPhotonId} enable-order="true" />
    </Dialog>
  );
};
