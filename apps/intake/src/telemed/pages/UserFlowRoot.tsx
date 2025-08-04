import mixpanel from 'mixpanel-browser';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { intakeFlowPageRoute } from '../../App';
import { useAppointmentStore } from '../features/appointments';
import { initialLocationState, LoadingScreen, useIntakeCommonStore } from '../features/common';
import { useFilesStore } from '../features/files';
import { usePatientInfoStore } from '../features/patient-info';
import { useGetPatients, usePatientsStore } from '../features/patients';
import { useOystehrAPIClient } from '../utils';

const UserFlowRoot = (): JSX.Element => {
  const apiClient = useOystehrAPIClient();
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

  if (getPatients.isFetching || !apiClient) {
    return <LoadingScreen />;
  }

  return <></>;
};

export default UserFlowRoot;
