import { Alert, Box } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useChartData } from 'src/features/css-module/hooks/useChartData';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { getPractitionerMissingFields } from 'src/shared/utils';
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

export enum ERXStatus {
  INITIAL,
  LOADING,
  READY,
  ERROR,
}

export const ERX: FC<{
  onStatusChanged: (status: ERXStatus) => void;
  showDefaultAlert: boolean;
}> = ({ onStatusChanged, showDefaultAlert }) => {
  const { patient, encounter } = getSelectors(useAppointmentStore, ['patient', 'encounter']);
  const phoneNumber = patient?.telecom?.find((telecom) => telecom.system === 'phone')?.value;
  const user = useEvolveUser();
  const practitioner = user?.profileResource;

  const [alertMessage, setAlertMessage] = useState<string | null>(
    showDefaultAlert ? 'If something goes wrong - please reload the page.' : null
  );

  const practitionerMissingFields = useMemo(() => {
    return practitioner ? getPractitionerMissingFields(practitioner) : [];
  }, [practitioner]);

  const [isTimeout, setIsTimeout] = useState<boolean>(false);

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

  console.log(isVitalsLoading, hasVitals, practitionerMissingFields);
  // Step 2: Check practitioner enrollment
  const {
    data: practitionerEnrollmentStatus,
    isFetched: isPractitionerEnrollmentChecked,
    refetch: refetchPractitionerEnrollment,
  } = useCheckPractitionerEnrollment({
    enabled: !isVitalsLoading && hasVitals && practitionerMissingFields.length === 0,
  });

  useEffect(() => {
    if (practitionerMissingFields.length > 0) {
      onStatusChanged(ERXStatus.ERROR);
    }
  }, [onStatusChanged, practitionerMissingFields]);

  // Step 3: Sync patient
  const { isFetched: isPatientSynced, isLoading: isPatientSyncing } = useSyncERXPatient({
    patient: patient!,
    enabled: Boolean(practitionerEnrollmentStatus?.confirmed && hasVitals),
    onError: (error) => {
      let errorMsg = 'Something went wrong while trying to sync patient to eRx';

      if (error.status === 400) {
        if (error.message?.includes('phone')) {
          errorMsg = `Patient has specified some wrong phone number: ${phoneNumber}. Please provide a real patient's phone number`;
        } else if (error.message?.includes('eRx service is not configured')) {
          errorMsg = `eRx service is not configured. Please contact support.`;
        } else {
          errorMsg = `Something is wrong with patient data.`;
        }
      }

      enqueueSnackbar(errorMsg, { variant: 'error' });
      onStatusChanged(ERXStatus.ERROR);
    },
  });

  // Step 4: Handle practitioner enrollment
  const {
    mutateAsync: enrollPractitioner,
    isPending: isEnrollingPractitioner,
    isError: isEnrollPractitionerError,
    isSuccess: isEnrollPractitionerSuccess,
  } = useEnrollPractitionerToERX({
    onError: () => {
      enqueueSnackbar('Enrolling practitioner to eRx failed', { variant: 'error' });
      onStatusChanged(ERXStatus.ERROR);
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
    isPending: isConnectingPractitioner,
    mutateAsync: connectPractitioner,
    isSuccess: isPractitionerConnected,
  } = useConnectPractitionerToERX({ patientId: patient?.id, encounterId: encounter.id });

  const {
    data: ssoLinkForEnrollment,
    isPending: isConnectingPractitionerForConfirmation,
    mutateAsync: connectPractitionerForConfirmation,
    isSuccess: isPractitionerConnectedForConfirmation,
  } = useConnectPractitionerToERX({});

  const connectPractitionerFn = useCallback(
    async (mode: 'confirmation' | 'ordering') => {
      try {
        await (mode === 'confirmation' ? connectPractitionerForConfirmation() : connectPractitioner());
        if (mode === 'confirmation') {
          setAlertMessage('When you complete the RxLink Agreement, please reload the page.');
        }
      } catch (error) {
        enqueueSnackbar('Something went wrong while trying to connect practitioner to eRx', { variant: 'error' });
        console.error('Error trying to connect practitioner to eRx: ', error);
        onStatusChanged(ERXStatus.ERROR);
      }
    },
    [connectPractitioner, connectPractitionerForConfirmation, onStatusChanged]
  );

  // Handle vitals validation
  useEffect(() => {
    if (isVitalsFetched && !hasVitals) {
      enqueueSnackbar(
        "Patient doesn't have height or weight vital specified. Please specify it first on the `Vitals` tab",
        { variant: 'error' }
      );
      onStatusChanged(ERXStatus.ERROR);
    }
  }, [isVitalsFetched, hasVitals, onStatusChanged]);

  // Handle practitioner enrollment
  useEffect(() => {
    if (
      isPractitionerEnrollmentChecked &&
      !practitionerEnrollmentStatus?.registered &&
      user?.profileResource?.id &&
      !isEnrollingPractitioner &&
      !isEnrollPractitionerError &&
      !isEnrollPractitionerSuccess
    ) {
      void enrollPractitionerFn(user.profileResource.id);
    }
  }, [
    isPractitionerEnrollmentChecked,
    practitionerEnrollmentStatus?.registered,
    user?.profileResource?.id,
    enrollPractitionerFn,
    isEnrollingPractitioner,
    isEnrollPractitionerError,
    isEnrollPractitionerSuccess,
  ]);

  // Handle practitioner connection for eRx
  useEffect(() => {
    if (
      practitionerEnrollmentStatus?.confirmed &&
      isPatientSynced &&
      !isConnectingPractitioner &&
      !isPractitionerConnected
    ) {
      void connectPractitionerFn('ordering');
    }
  }, [
    practitionerEnrollmentStatus?.confirmed,
    isPatientSynced,
    connectPractitionerFn,
    isConnectingPractitioner,
    isPractitionerConnected,
  ]);

  // Handle practitioner connection for confirmation
  useEffect(() => {
    if (
      practitionerEnrollmentStatus?.registered &&
      (!practitionerEnrollmentStatus?.confirmed || !practitionerEnrollmentStatus?.identityVerified) &&
      !isConnectingPractitionerForConfirmation &&
      !isPractitionerConnectedForConfirmation
    ) {
      void connectPractitionerFn('confirmation');
    }
  }, [
    isPatientSynced,
    connectPractitionerFn,
    isConnectingPractitionerForConfirmation,
    isPractitionerConnectedForConfirmation,
    practitionerEnrollmentStatus,
  ]);

  // Handle ready state
  useEffect(() => {
    if (isPractitionerConnected) {
      onStatusChanged(ERXStatus.READY);
    }
  }, [onStatusChanged, isPractitionerConnected]);

  useEffect(() => {
    if (isTimeout && !isPractitionerConnected) {
      onStatusChanged(ERXStatus.ERROR);
    } else if (
      isHeightLoading ||
      isWeightLoading ||
      isPatientSyncing ||
      isEnrollingPractitioner ||
      isConnectingPractitioner ||
      isConnectingPractitionerForConfirmation
    ) {
      onStatusChanged(ERXStatus.LOADING);
    }
  }, [
    isHeightLoading,
    isWeightLoading,
    isPatientSyncing,
    onStatusChanged,
    isEnrollingPractitioner,
    isConnectingPractitioner,
    isConnectingPractitionerForConfirmation,
    isTimeout,
    isPractitionerConnected,
  ]);

  // Timeout after 30 seconds
  useEffect(() => {
    setTimeout(() => {
      setIsTimeout(true);
    }, 30000);
  }, []);

  return (
    <>
      <Box>
        {(practitionerMissingFields.length > 0 && (
          <Alert severity="warning">
            To be able to prescribe please fill in the following fields in your profile:{' '}
            {practitionerMissingFields.join(', ')}.
          </Alert>
        )) ||
          (alertMessage && <Alert severity="info">{alertMessage}</Alert>)}
        {(ssoLink || ssoLinkForEnrollment) && <ERXDialog ssoLink={ssoLink || ssoLinkForEnrollment || ''} />}
      </Box>
    </>
  );
};
