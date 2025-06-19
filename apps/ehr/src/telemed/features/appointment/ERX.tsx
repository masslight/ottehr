import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useChartData } from 'src/features/css-module/hooks/useChartData';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { getPractitionerNPIIdentifier, VitalFieldNames } from 'utils';
import { createVitalsSearchConfig } from 'utils/lib/helpers/visit-note/create-vitals-search-config.helper';
import { getSelectors } from '../../../shared/store/getSelectors';
import {
  useAppointmentStore,
  useCheckPractitionerEnrollment,
  useConnectPractitionerToERX as useConnectPractitionerToToConfirmEnrollment,
  useEnrollPractitionerToERX,
  useSyncERXPatient,
} from '../../state';
import { ERXDialog } from './ERXDialog';

export const ERX: FC<{
  onClose: () => void;
  onStatusChange: (status: 'loading' | 'success') => void;
}> = ({ onClose, onStatusChange }) => {
  const { patient, encounter } = getSelectors(useAppointmentStore, ['patient', 'encounter']);
  const phoneNumber = patient?.telecom?.find((telecom) => telecom.system === 'phone')?.value;
  const user = useEvolveUser();
  const practitioner = user?.profileResource;

  const [alertMessage, setAlertMessage] = useState<string | null>(
    'If something goes wrong - please close and open the page again.'
  );

  const practitionerMissingFields: string[] = useMemo(() => {
    const missingFields: string[] = [];
    if (!practitioner) return [];
    if (!practitioner?.birthDate) {
      missingFields.push('birth date');
    }
    if (!practitioner?.telecom?.find((telecom) => telecom.system === 'phone')?.value) {
      missingFields.push('phone');
    }
    if (!practitioner?.telecom?.find((telecom) => telecom.system === 'fax')?.value) {
      missingFields.push('fax');
    }
    if (!practitioner?.address?.find((address) => address.line?.length)) {
      missingFields.push('Address line 1');
    }
    if (!practitioner?.address?.find((address) => address.city)) {
      missingFields.push('City');
    }
    if (!practitioner?.address?.find((address) => address.state)) {
      missingFields.push('State');
    }
    if (!practitioner?.address?.find((address) => address.postalCode)) {
      missingFields.push('Zip code');
    }
    if (!getPractitionerNPIIdentifier(practitioner)) {
      missingFields.push('NPI');
    }
    return missingFields;
  }, [practitioner]);

  useEffect(() => {
    if (practitionerMissingFields.length > 0) {
      setAlertMessage(`To be able to proceed please fill in the following fields in your profile:
              ${practitionerMissingFields.join(', ')}`);
    }
  }, [practitionerMissingFields]);

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
    data: practitionerEnrollmentStatus,
    isLoading: isCheckingPractitionerEnrollment,
    isFetched: isPractitionerEnrollmentChecked,
    refetch: refetchPractitionerEnrollment,
  } = useCheckPractitionerEnrollment({
    enabled: !isVitalsLoading && hasVitals && practitionerMissingFields.length === 0,
  });

  // Step 3: Sync patient
  const { isLoading: isSyncingPatient, isFetched: isPatientSynced } = useSyncERXPatient({
    patient: patient!,
    enabled: Boolean(practitionerEnrollmentStatus?.confirmed && hasVitals),
    onError: (error) => {
      let errorMsg = 'Something went wrong while trying to sync patient to eRx';

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
  const {
    mutateAsync: enrollPractitioner,
    isLoading: isEnrollingPractitioner,
    isError: isEnrollPractitionerError,
    isSuccess: isEnrollPractitionerSuccess,
  } = useEnrollPractitionerToERX({
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
  } = useConnectPractitionerToToConfirmEnrollment({ patientId: patient?.id });

  const {
    data: ssoLinkForEnrollment,
    isLoading: isConnectingPractitionerForConfirmation,
    mutateAsync: connectPractitionerForConfirmation,
    isSuccess: isPractitionerConnectedForConfirmation,
  } = useConnectPractitionerToToConfirmEnrollment({});

  const connectPractitionerFn = useCallback(
    async (mode: 'confirmation' | 'ordering') => {
      try {
        await (mode === 'confirmation' ? connectPractitionerForConfirmation() : connectPractitioner());
        if (mode === 'confirmation') {
          setAlertMessage(
            'When you complete the RxLink Agreement, please close the eRx by clicking the "Close eRx" button and open it again to start prescribing.'
          );
        }
      } catch (error) {
        enqueueSnackbar('Something went wrong while trying to connect practitioner to eRx', { variant: 'error' });
        console.error('Error trying to connect practitioner to eRx: ', error);
      }
    },
    [connectPractitioner, connectPractitionerForConfirmation]
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
      !practitionerEnrollmentStatus?.confirmed &&
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
    practitionerEnrollmentStatus?.registered,
    practitionerEnrollmentStatus?.confirmed,
  ]);

  // Handle loading state
  useEffect(() => {
    if (
      isVitalsLoading ||
      isCheckingPractitionerEnrollment ||
      isSyncingPatient ||
      isConnectingPractitioner ||
      isEnrollingPractitioner
    ) {
      onStatusChange('loading');
    }
  }, [
    onStatusChange,
    isVitalsLoading,
    isCheckingPractitionerEnrollment,
    isSyncingPatient,
    isConnectingPractitioner,
    isEnrollingPractitioner,
  ]);

  // Handle success state
  useEffect(() => {
    if (isPractitionerConnected) {
      onStatusChange('success');
    }
  }, [onStatusChange, isPractitionerConnected]);

  return (
    <>
      <Box>
        <Dialog open={alertMessage != null} fullWidth>
          <DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
            Error
          </DialogTitle>
          <DialogContent>{alertMessage}</DialogContent>
          <DialogActions>
            <Button onClick={onClose} variant="text" color="primary" size="medium">
              OK
            </Button>
          </DialogActions>
        </Dialog>
        {(ssoLink || ssoLinkForEnrollment) && <ERXDialog ssoLink={ssoLink || ssoLinkForEnrollment || ''} />}
      </Box>
    </>
  );
};
