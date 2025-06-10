import { Alert, AlertTitle, Box } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect } from 'react';
import { useChartData } from 'src/features/css-module/hooks/useChartData';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { VitalFieldNames } from 'utils';
import { createVitalsSearchConfig } from 'utils/lib/helpers/visit-note/create-vitals-search-config.helper';
import { getSelectors } from '../../../shared/store/getSelectors';
import {
  useAppointmentStore,
  useCheckPractitionerEnrollment,
  useConnectPractitionerToERX,
  useEnrollPractitionerToERX,
  useSyncERXPatient,
} from '../../state';
import { ERXDialog } from './ERXDialog';

export const ERX: FC<{
  onClose: () => void;
  onLoadingStatusChange: (loading: boolean) => void;
}> = ({ onClose, onLoadingStatusChange }) => {
  const { patient, encounter } = getSelectors(useAppointmentStore, ['patient', 'encounter']);
  const phoneNumber = patient?.telecom?.find((telecom) => telecom.system === 'phone')?.value;
  const user = useEvolveUser();

  // todo: check if provider has everything to be enrolled and give alert if not
  // const isProviderHasEverythingToBeEnrolled = Boolean(user?.profileResource?.id && phoneNumber && encounter?.id);

  // Step 1: Get patient vitals
  const heightSearchConfig = createVitalsSearchConfig(VitalFieldNames.VitalHeight, 'patient', 1);
  const weightSearchConfig = createVitalsSearchConfig(VitalFieldNames.VitalWeight, 'patient', 1);

  const {
    chartData: heightVitalObservationResponse,
    isLoading: isHeightLoading,
    isFetched: isHeightFetched,
  } = useChartData({
    encounterId: encounter.id!,
    requestedFields: { [heightSearchConfig.fieldName]: heightSearchConfig.searchParams },
    enabled: Boolean(encounter?.id),
  });

  const {
    chartData: weightVitalObservationResponse,
    isLoading: isWeightLoading,
    isFetched: isWeightFetched,
  } = useChartData({
    encounterId: encounter.id!,
    requestedFields: { [weightSearchConfig.fieldName]: weightSearchConfig.searchParams },
    enabled: Boolean(encounter?.id),
  });

  const hasVitals = Boolean(
    heightVitalObservationResponse?.vitalsObservations?.find((obs) => obs.field === VitalFieldNames.VitalHeight) &&
      weightVitalObservationResponse?.vitalsObservations?.find((obs) => obs.field === VitalFieldNames.VitalWeight)
  );
  const isVitalsLoading = isHeightLoading || isWeightLoading;
  const isVitalsFetched = isHeightFetched && isWeightFetched;

  // Step 2: Check practitioner enrollment
  const {
    data: isPractitionerEnrolled,
    isLoading: isCheckingPractitionerEnrollment,
    isFetched: isPractitionerEnrollmentChecked,
    refetch: refetchPractitionerEnrollment,
  } = useCheckPractitionerEnrollment({
    enabled: !isVitalsLoading && hasVitals,
  });

  // Step 3: Sync patient
  const { isLoading: isSyncingPatient, isFetched: isPatientSynced } = useSyncERXPatient({
    patient: patient!,
    enabled: Boolean(isPractitionerEnrolled && hasVitals),
    onError: (error) => {
      let errorMsg = 'Something went wrong while trying to open eRX';

      if (error.status === 400) {
        if (error.message?.includes('phone')) {
          errorMsg = `Patient has specified some wrong phone number: ${phoneNumber}. RX can be used only when a real phone number is provided`;
        } else if (error.message?.includes('eRx service is not configured')) {
          errorMsg = `eRx service is not configured. Please contact support.`;
        } else {
          errorMsg = `Something is wrong with patient data.`;
        }
      }

      enqueueSnackbar(errorMsg, { variant: 'error' });
      onClose();
    },
  });

  // Step 4: Handle practitioner enrollment
  const { mutateAsync: enrollPractitioner, isLoading: isEnrollingPractitioner } = useEnrollPractitionerToERX({
    onError: () => {
      enqueueSnackbar('Enrolling practitioner to eRx failed', { variant: 'error' });
      onClose();
    },
  });

  const enrollPractitionerFn = useCallback(
    async (practitionerId: string) => {
      try {
        await enrollPractitioner(practitionerId);
        await refetchPractitionerEnrollment();
      } catch (error) {
        console.error('Error enrolling practitioner:', error);
      }
    },
    [enrollPractitioner, refetchPractitionerEnrollment]
  );

  // Step 5: Connect practitioner
  const {
    data: ssoLink,
    isLoading: isConnectingPractitioner,
    mutateAsync: connectPractitioner,
    isSuccess: isPractitionerConnected,
  } = useConnectPractitionerToERX();

  const connectPractitionerFn = useCallback(
    async (mode: 'enrollment' | 'ordering') => {
      try {
        await connectPractitioner(mode === 'enrollment' ? undefined : patient);
      } catch (error) {
        enqueueSnackbar('Something went wrong while trying to connect practitioner to eRx', { variant: 'error' });
        console.error('Error trying to connect practitioner to eRx: ', error);
      }
    },
    [connectPractitioner, patient]
  );

  // Handle vitals validation
  useEffect(() => {
    if (isVitalsFetched && !hasVitals) {
      enqueueSnackbar(
        "Patient doesn't have height or weight vital specified. Please specify it first on the `Vitals` tab",
        { variant: 'error' }
      );
    }
  }, [isVitalsFetched, hasVitals]);

  // Handle practitioner enrollment
  useEffect(() => {
    if (
      isPractitionerEnrollmentChecked &&
      !isPractitionerEnrolled &&
      user?.profileResource?.id &&
      !isEnrollingPractitioner
    ) {
      void enrollPractitionerFn(user.profileResource.id);
    }
  }, [
    isPractitionerEnrollmentChecked,
    isPractitionerEnrolled,
    user?.profileResource?.id,
    enrollPractitionerFn,
    isEnrollingPractitioner,
  ]);

  // Handle practitioner connection
  useEffect(() => {
    if (isPractitionerEnrolled && isPatientSynced && !isConnectingPractitioner && !isPractitionerConnected) {
      void connectPractitionerFn('ordering');
    }
  }, [
    isPractitionerEnrolled,
    isPatientSynced,
    connectPractitionerFn,
    isConnectingPractitioner,
    isPractitionerConnected,
  ]);

  // Handle loading state
  useEffect(() => {
    const isLoading =
      isVitalsLoading ||
      isCheckingPractitionerEnrollment ||
      isSyncingPatient ||
      isConnectingPractitioner ||
      isEnrollingPractitioner;

    onLoadingStatusChange(isLoading);
  }, [
    onLoadingStatusChange,
    isVitalsLoading,
    isCheckingPractitionerEnrollment,
    isSyncingPatient,
    isConnectingPractitioner,
    isEnrollingPractitioner,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      onLoadingStatusChange(false);
    };
  }, [onLoadingStatusChange]);

  return (
    <>
      <Box>
        <Alert severity="info">
          <AlertTitle>eRX is an integration with a third party service</AlertTitle>
          If something goes wrong - please close and open the eRX again.
        </Alert>
        {ssoLink && <ERXDialog ssoLink={ssoLink} />}
      </Box>
    </>
  );
};
