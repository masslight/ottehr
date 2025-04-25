import { Typography } from '@mui/material';
import { FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import PatientList from '../features/patients/components/selectable-list';
import { PageContainer } from '../components';

const MyPatients = (): JSX.Element => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // todo
  /*
  if (false) {
    return (
      <PageContainer title={t('welcomeBack.loading')}>
        <CircularProgress />
      </PageContainer>
    );
  }*/

  const onBack = (): void => {
    navigate(`/home`);
  };

  const onSubmit = async (data: FieldValues): Promise<void> => {
    console.log('onSubmit data', data);
  };

  return (
    <PageContainer title={t('welcomeBack.title')}>
      <Typography variant="body1" marginTop={2}>
        {t('welcomeBack.body1')}
      </Typography>
      <Typography variant="body1" marginTop={1} marginBottom={2}>
        {t('welcomeBack.body2')}
      </Typography>
      <PatientList patients={[]} onSubmit={onSubmit} onBack={onBack} />
    </PageContainer>
  );
};

export default MyPatients;
