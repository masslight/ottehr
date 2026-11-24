import { LoadingButton } from '@mui/lab';
import { Alert, CircularProgress, Stack } from '@mui/material';
import { FC } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { RoleType } from 'utils/lib/types/api/user.types';
import { PageTitle } from '../../../shared/components/PageTitle';
import { useCheckSurescriptsEnrollment } from '../../../shared/hooks/useCheckSurescriptsEnrollment';
import { useEnrollSurescriptsWithToast } from '../../../shared/hooks/useEnrollSurescriptsPractitioner';
import { useErxSavedForm, useSaveErxForm } from '../../../shared/hooks/useErxSavedForm';
import { useAppointmentData } from '../../../shared/stores/appointment/appointment.store';
import { OrderPrescriptionForm } from './OrderPrescriptionForm';
import { PrescriptionTable } from './PrescriptionTable';

export const ERXSurescriptsBody: FC = () => {
  const { data: enrollment, isLoading, error } = useCheckSurescriptsEnrollment();
  const { enroll, isEnrolling } = useEnrollSurescriptsWithToast();
  // Only a provider prescribes, so only a provider enrolls, as in the user menu.
  const userIsProvider = useEvolveUser()?.hasRole([RoleType.Provider]);
  // The form saved for a provider to send fills the form when it opens, so the form waits for it (requirement 53b).
  const encounterId = useAppointmentData().encounter?.id;
  const savedForm = useErxSavedForm(encounterId);
  const { mutateAsync: saveForm } = useSaveErxForm(encounterId);

  return (
    <Stack spacing={1} sx={{ flex: '1 0 auto' }}>
      <PageTitle label="eRx (Surescripts)" showIntakeNotesButton={false} />
      {(isLoading || savedForm.isLoading) && <CircularProgress size={24} />}
      {error && <Alert severity="error">Unable to check your Surescripts registration. Please try again later.</Alert>}
      {enrollment && !enrollment.registered && (
        <>
          <Alert severity="warning">You are not enrolled in Surescripts e-prescribing.</Alert>
          {userIsProvider && (
            <LoadingButton variant="contained" loading={isEnrolling} onClick={enroll} sx={{ alignSelf: 'flex-start' }}>
              Enroll
            </LoadingButton>
          )}
        </>
      )}
      {/* Someone not enrolled fills the form in for a provider to send (requirement 53a), without the table. */}
      {enrollment && !savedForm.isLoading && (
        <>
          <OrderPrescriptionForm
            notEnrolled={!enrollment.registered}
            saved={savedForm.data?.saved}
            onSaveForm={saveForm}
          />
          {enrollment.registered && <PrescriptionTable />}
        </>
      )}
    </Stack>
  );
};
