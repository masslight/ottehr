import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IntakeFlowPageRoute } from '../App';
import { LoadingScreen } from '../features/common';
import { usePatientInfoStore } from '../features/patient-info';
import { useZapEHRAPIClient } from '../utils';
import { useGetPatients, usePatientsStore } from '../features/patients';

const UserFlowRoot = (): JSX.Element => {
  const apiClient = useZapEHRAPIClient();
  const navigate = useNavigate();

  const getPatients = useGetPatients(apiClient, (data) => {
    usePatientsStore.setState({ patients: data.patients });
    if (data?.patients.length > 0) {
      if (localStorage.getItem('fromHome') === 'true') {
        localStorage.removeItem('fromHome');
        navigate(IntakeFlowPageRoute.PatientPortal.path);
      } else {
        navigate(`${IntakeFlowPageRoute.SelectPatient.path}?flow=requestVisit`);
      }
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
