import { LoadingButton } from '@mui/lab';
import { Alert, CircularProgress, Stack } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC } from 'react';
import { PageTitle } from '../../../shared/components/PageTitle';
import { useCheckSurescriptsEnrollment } from '../../../shared/hooks/useCheckSurescriptsEnrollment';
import { useEnrollSurescriptsPractitioner } from '../../../shared/hooks/useEnrollSurescriptsPractitioner';
import { OrderPrescriptionForm } from './OrderPrescriptionForm';

export const ERXSurescriptsBody: FC = () => {
  const { data: enrollment, isLoading, error } = useCheckSurescriptsEnrollment();
  const { mutateAsync: enroll, isPending: isEnrolling } = useEnrollSurescriptsPractitioner();

  const handleEnroll = async (): Promise<void> => {
    try {
      await enroll();
      enqueueSnackbar('Enrolled in Surescripts', { variant: 'success' });
    } catch (enrollError) {
      console.error(`Error enrolling in Surescripts: ${enrollError}`);
      enqueueSnackbar(
        enrollError instanceof Error && enrollError.message
          ? enrollError.message
          : 'An error occurred while enrolling in Surescripts. Please try again.',
        { variant: 'error' }
      );
    }
  };

  return (
    <Stack spacing={1} sx={{ flex: '1 0 auto' }}>
      <PageTitle label="eRx (Surescripts)" showIntakeNotesButton={false} />
      {isLoading && <CircularProgress size={24} />}
      {error && <Alert severity="error">Unable to check your Surescripts registration. Please try again later.</Alert>}
      {enrollment && !enrollment.registered && (
        <>
          <Alert severity="warning">You are not enrolled in Surescripts e-prescribing.</Alert>
          <LoadingButton
            variant="contained"
            loading={isEnrolling}
            onClick={handleEnroll}
            sx={{ alignSelf: 'flex-start' }}
          >
            Enroll
          </LoadingButton>
        </>
      )}
      {enrollment?.registered && <OrderPrescriptionForm />}
    </Stack>
  );
};
