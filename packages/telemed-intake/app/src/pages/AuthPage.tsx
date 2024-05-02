import { useAuth0 } from '@auth0/auth0-react';
import { FC, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { IntakeFlowPageRoute } from '../App';
import { LoadingScreen, ErrorFallbackScreen } from '../features/common';

const AuthPage: FC = () => {
  const { isAuthenticated, loginWithRedirect, isLoading, error } = useAuth0();
  const authRef = useRef<Promise<void> | null>(null);

  if (error) {
    return <ErrorFallbackScreen />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    if (!authRef.current) {
      authRef.current = loginWithRedirect();
    }
    return <LoadingScreen />;
  }

  return <Navigate to={IntakeFlowPageRoute.Homepage.path} />;
};

export default AuthPage;
