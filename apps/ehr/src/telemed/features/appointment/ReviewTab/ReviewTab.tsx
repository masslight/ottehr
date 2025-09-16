import { Box, CircularProgress } from '@mui/material';
import { FC, useCallback } from 'react';
import { useFeatureFlags } from 'src/features/css-module/context/featureFlags';
import { telemedProgressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { useAppointmentData, useChartData, useGetReviewAndSignData } from '../../../state';
import { AddendumCard } from './AddendumCard';
import { MissingCard } from './MissingCard';
import { ReviewAndSignButton } from './ReviewAndSignButton';
import { SendFaxButton } from './SendFaxButton';
import { VisitNoteCard } from './VisitNoteCard';

export const ReviewTab: FC = () => {
  const { appointment, encounter, appointmentSetState } = useAppointmentData();
  const { css } = useFeatureFlags();

  const {
    setPartialChartData,
    isFetching,
    isLoading: isChartDataLoading,
  } = useChartData({
    requestedFields: telemedProgressNoteChartDataRequestedFields,
    onSuccess: (data) => {
      setPartialChartData({
        prescribedMedications: data?.prescribedMedications,
        disposition: data?.disposition,
        medicalDecision: data?.medicalDecision,
      });
    },
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
        <SendFaxButton appointment={appointment} encounter={encounter} css={css} />
        <ReviewAndSignButton onSigned={onAppointmentSigned} />
      </Box>
    </Box>
  );
};
