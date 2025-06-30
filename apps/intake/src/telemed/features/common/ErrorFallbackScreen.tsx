import { useNavigate } from 'react-router-dom';
import { intakeFlowPageRoute } from '../../../App';
import PageForm from '../../../components/PageForm';
import { CustomContainer } from './CustomContainer';

export const ErrorFallbackScreen = (): JSX.Element => {
  const navigate = useNavigate();

  const onSubmit = async (): Promise<void> => {
    navigate(intakeFlowPageRoute.Homepage.path);
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
