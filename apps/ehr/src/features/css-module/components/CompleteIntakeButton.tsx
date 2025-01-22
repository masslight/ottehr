import React from 'react';
import { getVisitStatus } from 'utils';
import { useAppointment } from '../hooks/useAppointment';
import { GenericToolTip } from '../../../components/GenericToolTip';
import { Box } from '@mui/system';
import { practitionerType } from '../../../helpers/practitionerUtils';
import { Button } from '@mui/material';
import { useParams } from 'react-router-dom';
import { usePractitionerActions } from '../hooks/usePractitioner';

export const CompleteIntakeButton = (): JSX.Element => {
  const { id: appointmentID } = useParams();
  const { telemedData, refetch } = useAppointment(appointmentID);
  const { encounter, appointment } = telemedData;
  const status = appointment && encounter ? getVisitStatus(appointment, encounter) : null;
  const { isPractitionerLoading, handleButtonClick } = usePractitionerActions(
    appointmentID ?? '',
    'end',
    practitionerType.Admitter
  );
  const isUnassignPractitionerButtonDisabled = status !== 'intake' || isPractitionerLoading;

  return (
    <GenericToolTip
      title={status !== 'intake' ? 'Only available in Intake status' : null}
      sx={{
        width: '120px',
        textAlign: 'center',
      }}
      placement="top"
    >
      <Box
        sx={{
          alignSelf: 'center',
        }}
      >
        <Button
          variant="contained"
          sx={{
            alignSelf: 'center',
            borderRadius: '20px',
            textTransform: 'none',
          }}
          onClick={async () => {
            try {
              await handleButtonClick();
              await refetch();
            } catch (error: any) {
              console.log(error.message);
            }
          }}
          disabled={isUnassignPractitionerButtonDisabled}
        >
          Complete Intake
        </Button>
      </Box>
    </GenericToolTip>
  );
};
