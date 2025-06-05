import { useAuth0 } from '@auth0/auth0-react';
import { FC } from 'react';
import { Navigate } from 'react-router-dom';
import { intakeFlowPageRoute } from '../../App';
import { ErrorFallbackScreen, LoadingScreen } from '../features/common';

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
