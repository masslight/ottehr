import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import mixpanel from 'mixpanel-browser';
import { intakeFlowPageRoute } from '../../App';
import { useIntakeCommonStore, LoadingScreen, initialLocationState } from '../features/common';
import { usePatientInfoStore } from '../features/patient-info';
import { useFilesStore } from '../features/files';
import { useAppointmentStore } from '../features/appointments';
import { useZapEHRAPIClient } from '../utils';
import { useGetPatients, usePatientsStore } from '../features/patients';

const UserFlowRoot = (): JSX.Element => {
  const apiClient = useZapEHRAPIClient();
  const navigate = useNavigate();

  const clearState = (): void => {
    mixpanel.track('New User');
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

  if (getPatients.isLoading || !apiClient) {
    return <LoadingScreen />;
  }

  return <></>;
};

export default UserFlowRoot;
