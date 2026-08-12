import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppointmentStore } from 'src/telemed/features/appointments/appointment.store';
import { initialLocationState, useIntakeCommonStore } from 'src/telemed/features/common/intake-common.store';
import { LoadingScreen } from 'src/telemed/features/common/LoadingScreen';
import { useFilesStore } from 'src/telemed/features/files/files.store';
import { usePatientInfoStore } from 'src/telemed/features/patient-info/patient-info.store';
import { useGetPatients } from 'src/telemed/features/patients/patients.queries';
import { usePatientsStore } from 'src/telemed/features/patients/patients.store';
import { useOystehrAPIClient } from 'src/telemed/utils/getOystehrAPI';
import { intakeFlowPageRoute } from '../../App';

const UserFlowRoot = (): JSX.Element => {
  const apiClient = useOystehrAPIClient();
  const navigate = useNavigate();

  const clearState = (): void => {
    useIntakeCommonStore.setState({ selectedLocationState: initialLocationState.selectedLocationState });
    useAppointmentStore.setState({ appointmentID: undefined, appointmentDate: undefined });
    usePatientInfoStore.getState().setNewPatient();
    useFilesStore.setState({ fileURLs: undefined, fileUploads: {} });
  };

  const getPatients = useGetPatients(apiClient, (data) => {
    usePatientsStore.setState({ patients: data?.patients });
    if (!data?.patients?.length) {
      // why is this the condition for clearing state??
      clearState();
    }
    navigate(intakeFlowPageRoute.Homepage.path);
  });

  useEffect(() => {
    if (apiClient) {
      getPatients.refetch().catch(console.error);
    }
  }, [apiClient, getPatients]);

  if (getPatients.isFetching || !apiClient) {
    return <LoadingScreen />;
  }

  return <></>;
};

export default UserFlowRoot;
