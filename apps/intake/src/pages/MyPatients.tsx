import { FieldValues } from 'react-hook-form';
import { generatePath, useNavigate } from 'react-router-dom';
import PatientList from '../features/patients/components/selectable-list';
import { PageContainer } from '../components';
import { intakeFlowPageRoute } from '../App';

const MyPatients = (): JSX.Element => {
  const navigate = useNavigate();

  // todo
  /*
  if (false) {
    return (
      <PageContainer title="Loading patients...">
        <CircularProgress />
      </PageContainer>
    );
  }*/

  const onBack = (): void => {
    navigate(`/home`);
  };

  const onSubmit = async (data: FieldValues): Promise<void> => {
    console.log('onSubmit data', data);

    const destination = generatePath(intakeFlowPageRoute.PastVisits.path, {
      patientId: 'todo',
    });
    navigate(destination);
  };

  return (
    <PageContainer title={'Select patient'}>
      <PatientList patients={[]} onSubmit={onSubmit} onBack={onBack} />
    </PageContainer>
  );
};

export default MyPatients;
