import { useAuth0 } from '@auth0/auth0-react';
import { FC } from 'react';
import { Navigate } from 'react-router-dom';
import { ErrorFallbackScreen } from 'src/telemed/features/common/ErrorFallbackScreen';
import { LoadingScreen } from 'src/telemed/features/common/LoadingScreen';
import { intakeFlowPageRoute } from '../../App';

const AuthPage: FC = () => {
  const { isLoading, error } = useAuth0();

  if (error) {
    return <ErrorFallbackScreen />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  const redirectDestination = localStorage.getItem('redirectDestination');

  if (redirectDestination) {
    return <Navigate to={redirectDestination} replace />;
  } else {
    return <Navigate to={intakeFlowPageRoute.Homepage.path} replace />;
  }
};

export default AuthPage;
