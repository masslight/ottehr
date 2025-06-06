import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect } from 'react';
import { useChartData } from 'src/features/css-module/hooks/useChartData';
import { VitalFieldNames } from 'utils';
import { createVitalsSearchConfig } from 'utils/lib/helpers/visit-note/create-vitals-search-config.helper';
import { getSelectors } from '../../../shared/store/getSelectors';
import {
  useAppointmentStore,
  useCheckPractitionerEnrollment,
  useConnectPractitionerToERX,
  useSyncERXPatient,
} from '../../state';
import { ERXDialog } from './ERXDialog';

export const ERX: FC<{
  onClose: () => void;
  onLoadingStatusChange: (loading: boolean) => void;
}> = ({ onClose, onLoadingStatusChange }) => {
  const { patient, encounter } = getSelectors(useAppointmentStore, ['patient', 'encounter']);
  const phoneNumber = patient?.telecom?.find((telecom) => telecom.system === 'phone')?.value;

  const heightSearchConfig = createVitalsSearchConfig(VitalFieldNames.VitalHeight, 'patient', 1);
  const weightSearchConfig = createVitalsSearchConfig(VitalFieldNames.VitalWeight, 'patient', 1);
  const {
    chartData: heightVitalObservation,
    isLoading: isHeightLoading,
    isFetched: isHeightFetched,
  } = useChartData({
    encounterId: encounter.id!,
    requestedFields: { [heightSearchConfig.fieldName]: heightSearchConfig.searchParams },
    enabled: Boolean(encounter?.id),
  });
  const {
    chartData: weightVitalObservation,
    isLoading: isWeightLoading,
    isFetched: isWeightFetched,
  } = useChartData({
    encounterId: encounter.id!,
    requestedFields: { [weightSearchConfig.fieldName]: weightSearchConfig.searchParams },
    enabled: Boolean(encounter?.id),
  });

  // Check if patient has height and weight vital specified, otherwise show error
  useEffect(() => {
    if (isHeightFetched && isWeightFetched) {
      if (!heightVitalObservation || !weightVitalObservation) {
        enqueueSnackbar(
          "Patient doesn't have height or weight vital specified. Please specify it first on the `Vitals` tab",
          {
            variant: 'error',
          }
        );
      }
    }
  }, [heightVitalObservation, weightVitalObservation, isHeightFetched, isWeightFetched]);

  // Query to check if practitioner is enrolled in eRx
  const {
    data: isPractitionerEnrolled,
    isLoading: isCheckingPractitionerEnrollment,
    isFetched: isPractitionerEnrollmentChecked,
  } = useCheckPractitionerEnrollment({
    enabled: !(isHeightLoading || isWeightLoading) && Boolean(heightVitalObservation && weightVitalObservation),
  });

  // Sync patient to eRx
  const { isLoading: isSyncingPatient, isFetched: isPatientSynced } = useSyncERXPatient({
    patient: patient!,
    enabled: Boolean(isPractitionerEnrolled),
    onError: (err) => {
      let errorMsg = 'Something went wrong while trying to open eRX';

      if (err.status === 400) {
        if (err.message && err.message.includes('phone')) {
          errorMsg = `Patient has specified some wrong phone number: ${phoneNumber}. RX can be used only when a real phone number is provided`;
        } else if (err.message && err.message.includes('eRx service is not configured')) {
          errorMsg = `eRx service is not configured. Please contact support.`;
        } else {
          errorMsg = `Something is wrong with patient data.`;
        }
      }

      enqueueSnackbar(errorMsg, {
        variant: 'error',
      });

      onClose();
    },
  });

  // Query to connect practitioner to eRx (enrollment or ordering)
  const {
    data: ssoLink,
    isLoading: isConnectingPractitioner,
    mutateAsync: connectPractitioner,
  } = useConnectPractitionerToERX();

  const connectPractitionerFn = useCallback(
    async (mode: 'enrollment' | 'ordering') => {
      try {
        await connectPractitioner(mode === 'enrollment' ? undefined : patient);
      } catch (err: any) {
        const errorMsg = 'Something went wrong while trying to connect practitioner to eRx';

        enqueueSnackbar(errorMsg, {
          variant: 'error',
        });

        console.error('Error trying to connect practitioner to eRx: ', err);
      }
    },
    [connectPractitioner, patient]
  );

  // Connect practitioner to eRx for enrollment if not enrolled yet
  useEffect(() => {
    if (isPractitionerEnrollmentChecked && !isPractitionerEnrolled && !isCheckingPractitionerEnrollment) {
      void connectPractitionerFn('enrollment');
    }
  }, [
    isPractitionerEnrolled,
    isCheckingPractitionerEnrollment,
    connectPractitionerFn,
    isPractitionerEnrollmentChecked,
  ]);

  useEffect(() => {
    if (isPractitionerEnrolled && isPatientSynced) {
      void connectPractitionerFn('ordering');
    }
  }, [isPractitionerEnrolled, connectPractitionerFn, isPatientSynced]);

  useEffect(() => {
    onLoadingStatusChange(
      isSyncingPatient ||
        isCheckingPractitionerEnrollment ||
        isConnectingPractitioner ||
        isWeightLoading ||
        isHeightLoading
    );
  }, [
    onLoadingStatusChange,
    isSyncingPatient,
    isCheckingPractitionerEnrollment,
    isConnectingPractitioner,
    isWeightLoading,
    isHeightLoading,
  ]);

  // useEffect(() => {
  //   if (isError) {
  //     onClose();
  //   }
  //   if (!syncedPatient && patient && !isSyncingPatient && !isError) {
  //     // void syncPatientFn();
  //   }
  //   if (!ssoLink && !isConnectingPractitioner && !isConnectingPractitionerError) {
  //     void connectPractitionerFn();
  //   }
  // }, [
  //   ssoLink,
  //   isError,
  //   isSyncingPatient,
  //   onClose,
  //   patient,
  //   syncPatientFn,
  //   connectPractitionerFn,
  //   syncedPatient,
  //   isConnectingPractitioner,
  //   isConnectingPractitionerError,
  // ]);

  return <>{ssoLink && <ERXDialog ssoLink={ssoLink} onClose={() => onClose()} />}</>;
};
