import { Button, CircularProgress, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { FC, useCallback, useState } from 'react';
import { radiologyLaunchViewer } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import radiologyIcon from 'src/themes/ottehr/icons/mui-radiology.svg';

interface RadiologyViewImageBtnProps {
  serviceRequestId: string;
  disabled: boolean;
  displaySmall: boolean;
}

export const RadiologyViewImageBtn: FC<RadiologyViewImageBtnProps> = (props: RadiologyViewImageBtnProps) => {
  const { serviceRequestId, disabled, displaySmall } = props;

  const { oystehrZambda } = useApiClients();

  const [isLaunchingViewer, setIsLaunchingViewer] = useState(false);
  const [launchViewerError, setLaunchViewerError] = useState<string | null>(null);

  const handleViewImageClick = useCallback(async (): Promise<void> => {
    setIsLaunchingViewer(true);
    setLaunchViewerError(null);

    if (!oystehrZambda) {
      console.error('oystehrZambda is not defined');
      setLaunchViewerError('Unable to launch viewer (API client unavailable)');
      setIsLaunchingViewer(false);
      return;
    }

    try {
      const response = await radiologyLaunchViewer(oystehrZambda, {
        serviceRequestId: serviceRequestId,
      });

      if (response) {
        window.open(response.url, '_blank');
      } else {
        setLaunchViewerError('Could not launch viewer');
      }
    } catch (err) {
      console.error('Error launching viewer:', err);
      setLaunchViewerError('An error occurred launching the viewer');
    } finally {
      setIsLaunchingViewer(false);
    }
  }, [serviceRequestId, oystehrZambda]);

  return (
    <>
      <Button
        size={displaySmall ? 'small' : 'medium'}
        variant={displaySmall ? 'text' : 'outlined'}
        startIcon={
          <Box
            component="img"
            src={radiologyIcon}
            style={{
              width: `${displaySmall ? '20px' : '30px'}`,
              marginRight: `${displaySmall ? '4px' : '8px'}`,
              filter: disabled || isLaunchingViewer ? 'grayscale(1) opacity(0.38)' : undefined,
            }}
          />
        }
        endIcon={isLaunchingViewer ? <CircularProgress size={16} color="inherit" /> : null}
        onClick={() => handleViewImageClick()}
        sx={{ borderRadius: '50px', textTransform: 'none' }}
        disabled={disabled || isLaunchingViewer}
      >
        {isLaunchingViewer ? 'Launching Image...' : 'View Image'}
      </Button>

      {launchViewerError && (
        <Box sx={{ mt: 2, color: 'error.main' }}>
          <Typography color="error">{launchViewerError}</Typography>
        </Box>
      )}
    </>
  );
};
