import { PageForm } from 'ottehr-components';
import { IntakeFlowPageRoute } from '../../App';
import { CustomContainer } from './CustomContainer';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const ErrorFallbackScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const onSubmit = async (): Promise<void> => {
    navigate(IntakeFlowPageRoute.AuthPage.path);
  };

  return (
    <CustomContainer
      title={t('errorFallbackScreen.title')}
      description={t('errorFallbackScreen.description')}
      bgVariant={IntakeFlowPageRoute.PatientPortal.path}
    >
      <PageForm onSubmit={onSubmit} controlButtons={{ submitLabel: t('general.button.login'), backButton: false }} />
    </CustomContainer>
  );
};
