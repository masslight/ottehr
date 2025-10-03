import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { Box, IconButton } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FHIR_EXTENSION } from 'utils';
import { useAppointmentData } from '../stores/appointment/appointment.store';

export const ERXDialog = ({ ssoLink }: { ssoLink: string }): ReactElement => {
  const { patient } = useAppointmentData();
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
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
          <Box
            sx={
              isOverlayOpen
                ? {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 1300,
                    backgroundColor: 'white',
                  }
                : {
                    minHeight: 600,
                    flex: '1 0 auto',
                  }
            }
          >
            <IconButton
              onClick={() => setIsOverlayOpen(!isOverlayOpen)}
              title={isOverlayOpen ? 'Close full screen' : 'Open full screen'}
              size="small"
              sx={{ position: 'absolute', right: isOverlayOpen ? 16 : 38 }}
            >
              {isOverlayOpen ? <CloseIcon /> : <OpenInFullIcon />}
            </IconButton>
            <iframe src={ssoLink} width="100%" height="100%" />
          </Box>,
          erxPortalElement
        )}
    </>
  );
};
