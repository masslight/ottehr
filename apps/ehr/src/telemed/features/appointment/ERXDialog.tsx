import { DialogProps } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FHIR_EXTENSION } from 'utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../state';

export const ERXDialog = ({ onClose, ssoLink }: { onClose: () => void; ssoLink: string }): ReactElement => {
  const { patient } = getSelectors(useAppointmentStore, ['patient']);
  let weight: number | undefined = Number.parseFloat(
    patient?.extension?.find((ext) => ext.url === FHIR_EXTENSION.Patient.weight.url)?.valueString ?? ''
  );
  if (isNaN(weight)) {
    weight = undefined;
  }

  const handleClose: DialogProps['onClose'] = (_, reason) => {
    if (reason === 'backdropClick') return;
    onClose();
  };

  const [erxPortalElement, setErxPortalElement] = useState<HTMLElement | null>();

  useEffect(() => {
    setErxPortalElement(document.getElementById('prescribe-dialog'));
  }, []);

  return <>{erxPortalElement && createPortal(<iframe src={ssoLink} width="100%" height="100%" />, erxPortalElement)}</>;
};
