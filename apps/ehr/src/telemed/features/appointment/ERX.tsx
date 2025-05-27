import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useState } from 'react';
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
  const { patient } = getSelectors(useAppointmentStore, ['patient']);
  const phoneNumber = patient?.telecom?.find((telecom) => telecom.system === 'phone')?.value;
  const [syncedPatient, setSyncedPatient] = useState(false);

  const { data: isPractitionerEnrolled, isLoading: isCheckingPractitionerEnrollment } =
    useCheckPractitionerEnrollment();
  const { isLoading: isSyncingPatient } = useSyncERXPatient({
    patient: patient!,
    enabled: Boolean(isPractitionerEnrolled),
    onError: (err) => {
      let errorMsg = 'Something went wrong while trying to open RX';

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
    },
  });

  const {
    data: ssoLink,
    isLoading: isConnectingPractitioner,
    mutateAsync: connectPractitioner,
    isError: isConnectingPractitionerError,
  } = useConnectPractitionerToERX();

  const connectPractitionerFn = useCallback(async () => {
    try {
      await connectPractitioner(undefined);
    } catch (err: any) {
      const errorMsg = 'Something went wrong while trying to connect practitioner to eRx';

      enqueueSnackbar(errorMsg, {
        variant: 'error',
      });

      console.error('Error trying to connect practitioner to eRx: ', err);
    }
  }, [connectPractitioner]);

  useEffect(() => {
    if (!isPractitionerEnrolled && !isCheckingPractitionerEnrollment) {
      void connectPractitionerFn();
    }
  }, [isPractitionerEnrolled, isCheckingPractitionerEnrollment, connectPractitionerFn]);

  useEffect(() => {
    onLoadingStatusChange(isSyncingPatient || isCheckingPractitionerEnrollment || isConnectingPractitioner);
  }, [onLoadingStatusChange, isSyncingPatient, isCheckingPractitionerEnrollment, isConnectingPractitioner]);

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

  return (
    <>
      {!isSyncingPatient && !isConnectingPractitioner && ssoLink && (
        <ERXDialog ssoLink={ssoLink} onClose={() => onClose()} />
      )}
    </>
  );
};
