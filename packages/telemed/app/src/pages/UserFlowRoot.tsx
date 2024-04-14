import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IntakeFlowPageRoute } from '../App';
import { useIntakeCommonStore, LoadingScreen } from '../features/common';
import { usePatientInfoStore } from '../features/patient-info';
import { useZapEHRAPIClient } from '../utils';
import { useGetPatients, usePatientsStore } from '../features/patients';

const UserFlowRoot = (): JSX.Element => {
  const apiClient = useZapEHRAPIClient();
  const navigate = useNavigate();

  useEffect(() => {
    const currentState = useIntakeCommonStore.getState();
    if (!currentState?.selectedLocationState) {
      navigate(IntakeFlowPageRoute.Welcome.path);
    }
  }, [navigate]);

  const getPatients = useGetPatients(apiClient, (data) => {
    usePatientsStore.setState({ patients: data.patients });
    if (data?.patients.length > 0) {
      navigate(IntakeFlowPageRoute.Homepage.path);
    } else {
      usePatientInfoStore.getState().setNewPatient();
      navigate(IntakeFlowPageRoute.NewUser.path);
    }
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
