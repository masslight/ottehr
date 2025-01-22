import { PageForm } from 'ui-components';
import { intakeFlowPageRoute } from '../../../App';
import { CustomContainer } from './CustomContainer';
import { useNavigate } from 'react-router-dom';

export const ErrorFallbackScreen = (): JSX.Element => {
  const navigate = useNavigate();

  const onSubmit = async (): Promise<void> => {
    navigate(intakeFlowPageRoute.AuthPage.path);
  };

  return (
    <CustomContainer
      title="Error occurred"
      description="Something went wrong during authorization process. Please, try again."
    >
      <PageForm onSubmit={onSubmit} controlButtons={{ submitLabel: 'Login', backButton: false }} />
    </CustomContainer>
  );
};
