import { Box } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FHIR_EXTENSION } from 'utils';
import { useAppointmentData } from '../../state';

export const ERXDialog = ({ ssoLink }: { ssoLink: string }): ReactElement => {
  const { patient } = useAppointmentData();

  let weight: number | undefined = Number.parseFloat(
    patient?.extension?.find((ext) => ext.url === FHIR_EXTENSION.Patient.weight.url)?.valueString ?? ''
  );

  if (isNaN(weight)) {
    weight = undefined;
  }

  const [erxPortalElement, setErxPortalElement] = useState<HTMLElement | null>();

  useEffect(() => {
    const portalElement = document.getElementById('prescribe-dialog');
    setErxPortalElement(portalElement);

    return () => {
      // Cleanup portal when component unmounts
      if (portalElement) {
        while (portalElement.firstChild) {
          portalElement.removeChild(portalElement.firstChild);
        }
      }
    };
  }, []); // Empty dependency array since we only want to set up and clean up once

  return (
    <>
      {erxPortalElement &&
        createPortal(
          <Box sx={{ minHeight: '600px', flex: '1 0 auto' }}>
            <iframe src={ssoLink} width="100%" height="100%" />
          </Box>,
          erxPortalElement
        )}
    </>
  );
};
