import React, { FC, useCallback } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore, useGetReviewAndSignData } from '../../../state';
import { MissingCard } from './MissingCard';
import { AddendumCard } from './AddendumCard';
import { VisitNoteCard } from './VisitNoteCard';
import { ReviewAndSignButton } from './ReviewAndSignButton';
import { useGetAppointmentAccessibility } from '../../../hooks';

export const ReviewTab: FC = () => {
  const { appointment, isChartDataLoading } = getSelectors(useAppointmentStore, ['appointment', 'isChartDataLoading']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { refetch: refetchReviewAndSingData } = useGetReviewAndSignData(
    {
      appointmentId: appointment?.id,
      runImmediately: false,
    },
    (reviewAndSignData) => {
      useAppointmentStore.setState({ reviewAndSignData: reviewAndSignData });
    }
  );

  const onAppointmentSigned = useCallback(async (): Promise<void> => {
    await refetchReviewAndSingData();
  }, [refetchReviewAndSingData]);

  if (isChartDataLoading) {
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
      {!isReadOnly && <ReviewAndSignButton onSigned={onAppointmentSigned} />}
    </Box>
  );
};
