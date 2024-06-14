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
    console.log(10);
    usePatientsStore.setState({ patients: data.patients });
    if (data?.patients.length > 0) {
      console.log(10);
      navigate(IntakeFlowPageRoute.Homepage.path);
    } else {
      console.log(20);
      usePatientInfoStore.getState().setNewPatient();
      navigate(IntakeFlowPageRoute.NewUser.path);
    }
  });

  useEffect(() => {
    console.log(1);
    if (apiClient) {
      getPatients.refetch().catch(console.error);
    }
    console.log(2);
  }, [apiClient, getPatients]);

  if (getPatients.isLoading || !apiClient) {
    return <LoadingScreen />;
  }

  return <></>;
};

export default UserFlowRoot;
