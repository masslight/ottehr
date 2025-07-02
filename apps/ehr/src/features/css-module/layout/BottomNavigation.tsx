import ArrowBackIcon from '@mui/icons-material/ChevronLeft';
import ArrowForwardIcon from '@mui/icons-material/ChevronRight';
import { LoadingButton } from '@mui/lab';
import { alpha, Box, Button, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React from 'react';
import { useParams } from 'react-router-dom';
import { PRACTITIONER_CODINGS } from 'utils';
import { useNavigationContext } from '../context/NavigationContext';
import { useAppointment } from '../hooks/useAppointment';
import { usePractitionerActions } from '../hooks/usePractitioner';

export const BottomNavigation = (): JSX.Element => {
  const { id: appointmentID } = useParams();
  const { visitState: telemedData, refetch } = useAppointment(appointmentID);
  const { encounter } = telemedData;
  const theme = useTheme();
  const {
    goToNext,
    goToPrevious,
    isNavigationHidden,
    isFirstPage,
    isLastPage,
    interactionMode,
    isNavigationDisabled,
    nextButtonText,
  } = useNavigationContext();
  const practitionerTypeFromMode =
    interactionMode === 'intake' ? PRACTITIONER_CODINGS.Admitter : PRACTITIONER_CODINGS.Attender;
  const { isEncounterUpdatePending, handleUpdatePractitioner } = usePractitionerActions(
    encounter,
    'end',
    practitionerTypeFromMode
  );

  const [nextButtonLoading, setNextButtonLoading] = React.useState<boolean>(false);

  const handleNextPage = async (): Promise<void> => {
    try {
      setNextButtonLoading(true);
      if (isLastPage && interactionMode === 'intake') {
        await handleUpdatePractitioner();
      }
      goToNext();
      await refetch();
    } catch (error: any) {
      console.log(error.message);
      enqueueSnackbar('An error occurred trying to complete intake. Please try again.', { variant: 'error' });
    } finally {
      setNextButtonLoading(false);
    }
  };

  if (isNavigationHidden) return <></>;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        margin: '0 0 0 -20px',
        width: 'calc(100% + 20px)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          height: '48px',
          boxShadow: '0px 0px 4px 2px rgba(0,0,0,0.1)',
        }}
      >
        <Button
          disabled={isFirstPage || isNavigationDisabled}
          startIcon={<ArrowBackIcon sx={{ width: '32px', height: '32px' }} />}
          onClick={goToPrevious}
          sx={{
            flex: 1,
            justifyContent: 'flex-start',
            backgroundColor: theme.palette.background.paper,
            borderRadius: 0,
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.light, 0.1),
            },
            color: theme.palette.primary.main,
            pl: 3,
            fontWeight: 'bold',
            textTransform: 'none',
            ...theme.typography.subtitle1,
            fontSize: '16px',
            borderRight: `1px solid ${theme.palette.primary.main}`,
          }}
        >
          Back
        </Button>
        <LoadingButton
          disabled={isNavigationDisabled || isEncounterUpdatePending || (isLastPage && interactionMode === 'provider')}
          loading={nextButtonLoading}
          endIcon={<ArrowForwardIcon sx={{ width: '32px', height: '32px' }} />}
          onClick={handleNextPage}
          sx={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: '#EDE8FF',
            borderRadius: 0,
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.light, 0.24),
            },
            color: theme.palette.primary.main,
            pr: 3,
            fontWeight: 'bold',
            textTransform: 'none',
            ...theme.typography.subtitle1,
            fontSize: '16px',
          }}
        >
          {nextButtonText}
        </LoadingButton>
      </Box>
    </Box>
  );
};
