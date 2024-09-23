import { Patient } from 'fhir/r4';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useState } from 'react';
import { ERX_PATIENT_IDENTIFIER_SYSTEM } from 'ehr-utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore, useSyncERXPatient } from '../../state';
import { ERXDialog } from './ERXDialog';

export const ERX: FC<{
  onClose: () => void;
  onLoadingStatusChange: (loading: boolean) => void;
}> = ({ onClose, onLoadingStatusChange }) => {
  const { patient } = getSelectors(useAppointmentStore, ['patient']);
  const phoneNumber = patient?.telecom?.find((telecom) => telecom.system === 'phone')?.value;
  const [syncedPatient, setSyncedPatient] = useState(false);

  const { isLoading: isSyncingPatient, mutateAsync: syncPatient, isError } = useSyncERXPatient();

  const photonPatientId = patient?.identifier?.find((id) => id.system === ERX_PATIENT_IDENTIFIER_SYSTEM)?.value;

  const syncPatientFn = useCallback(async () => {
    try {
      const response = await syncPatient(patient!);
      if (response.photonPatientId) {
        useAppointmentStore.setState((state) => {
          const oldPatient = (state.patient || {}) as Patient;
          return {
            patient: {
              ...oldPatient,
              identifier: [
                ...(oldPatient?.identifier || []),
                { system: ERX_PATIENT_IDENTIFIER_SYSTEM, value: response.photonPatientId },
              ],
            },
          };
        });
      }
      setSyncedPatient(true);
    } catch (err: any) {
      let errorMsg = 'Something went wrong while trying to open RX';

      if (err.status === 400) {
        if (err.message && err.message.includes('phone')) {
          errorMsg = `Patient has specified some wrong phone number: ${phoneNumber}. RX can be used only when a real phone number is provided`;
        } else {
          errorMsg = `Something is wrong with patient data.`;
        }
      }

      enqueueSnackbar(errorMsg, {
        variant: 'error',
      });

      console.error('Error trying to sync patient to photon: ', err);
    }
  }, [patient, phoneNumber, syncPatient]);

  useEffect(() => {
    onLoadingStatusChange(isSyncingPatient);
  }, [onLoadingStatusChange, isSyncingPatient]);

  useEffect(() => {
    if (isError) {
      onClose();
    }
    if (!syncedPatient && patient && !isSyncingPatient && !isError) {
      void syncPatientFn();
    }
  }, [syncedPatient, isError, isSyncingPatient, onClose, patient, syncPatientFn]);

  return (
    <>
      {photonPatientId && !isSyncingPatient && (
        <ERXDialog patientPhotonId={photonPatientId} onClose={() => onClose()} />
      )}
    </>
  );
};
