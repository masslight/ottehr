import { Box, CircularProgress } from '@mui/material';
import { FC, useCallback } from 'react';
import { useGetReviewAndSignData } from 'src/shared/hooks/appointment/appointment.queries';
import { useAppointmentData } from 'src/shared/hooks/appointment/appointment.store';
import { useChartFields } from 'src/shared/hooks/appointment/useChartFields';
import { telemedProgressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { useAppFlags } from '../../shared/contexts/useAppFlags';
import { AddendumCard } from './AddendumCard';
import { MissingCard } from './MissingCard';
import { ReviewAndSignButton } from './ReviewAndSignButton';
import { SendFaxButton } from './SendFaxButton';
import { VisitNoteCard } from './VisitNoteCard';

export const ReviewTab: FC = () => {
  const { appointment, encounter, appointmentSetState } = useAppointmentData();
  const { isInPerson: inPerson } = useAppFlags();

  const { isFetching, isLoading: isChartDataLoading } = useChartFields({
    requestedFields: telemedProgressNoteChartDataRequestedFields,
  });

  const { refetch: refetchReviewAndSignData } = useGetReviewAndSignData(
    {
      appointmentId: appointment?.id,
      runImmediately: false,
    },
    (reviewAndSignData) => {
      appointmentSetState({ reviewAndSignData: reviewAndSignData });
    }
  );

  const onAppointmentSigned = useCallback(async (): Promise<void> => {
    await refetchReviewAndSignData();
  }, [refetchReviewAndSignData]);

  if (isChartDataLoading || isFetching) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <MissingCard />
      <VisitNoteCard />
      <AddendumCard />
      <Box sx={{ display: 'flex', justifyContent: 'end', gap: 1 }}>
        <SendFaxButton appointment={appointment} encounter={encounter} inPerson={inPerson} />
        <ReviewAndSignButton onSigned={onAppointmentSigned} />
      </Box>
    </Box>
  );
};
