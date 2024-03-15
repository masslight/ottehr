import { PageForm } from 'ottehr-components';
import { IntakeFlowPageRoute } from '../../App';
import { CustomContainer } from './CustomContainer';
import { useNavigate } from 'react-router-dom';

export const ErrorFallbackScreen = (): JSX.Element => {
  const navigate = useNavigate();

  const onSubmit = async (): Promise<void> => {
    navigate(IntakeFlowPageRoute.AuthPage.path);
  };

  return (
    <CustomContainer
      title="Error occurred"
      description="Something went wrong during authorization process. Please, try again."
      bgVariant={IntakeFlowPageRoute.Homepage.path}
    >
      <PageForm onSubmit={onSubmit} controlButtons={{ submitLabel: 'Login', backButton: false }} />
    </CustomContainer>
  );
};
