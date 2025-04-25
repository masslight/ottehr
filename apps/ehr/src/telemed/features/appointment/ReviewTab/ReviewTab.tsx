import { Box, CircularProgress } from '@mui/material';
import { FC, useCallback, useRef } from 'react';
import { telemedProgressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { useChartData } from '../../../../features/css-module/hooks/useChartData';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useGetAppointmentAccessibility } from '../../../hooks';
import { useAppointmentStore, useGetReviewAndSignData } from '../../../state';
import { AddendumCard } from './AddendumCard';
import { MissingCard } from './MissingCard';
import { ReviewAndSignButton } from './ReviewAndSignButton';
import { VisitNoteCard } from './VisitNoteCard';

export const ReviewTab: FC = () => {
  const isInitialLoad = useRef(true);
  const { appointment, isChartDataLoading, setPartialChartData } = getSelectors(useAppointmentStore, [
    'appointment',
    'isChartDataLoading',
    'setPartialChartData',
  ]);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);

  const { isFetching } = useChartData({
    encounterId: encounter.id || '',
    requestedFields: telemedProgressNoteChartDataRequestedFields,
    onSuccess: (data) => {
      isInitialLoad.current = false;
      setPartialChartData({
        prescribedMedications: data.prescribedMedications,
        disposition: data.disposition,
      });
    },
    onError: () => {
      isInitialLoad.current = false;
    },
    enabled: isInitialLoad.current,
  });

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
      {!isReadOnly && <ReviewAndSignButton onSigned={onAppointmentSigned} />}
    </Box>
  );
};
