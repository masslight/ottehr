import { useAuth0 } from '@auth0/auth0-react';
import { FC, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { IntakeFlowPageRoute } from '../App';
import { ErrorFallbackScreen, LoadingScreen } from '../features/common';

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
  if (localStorage.getItem('fromHome') === 'true') {
    localStorage.removeItem('fromHome');
    return <Navigate to={IntakeFlowPageRoute.PatientPortal.path} />;
  }
  return <Navigate to={`${IntakeFlowPageRoute.SelectPatient.path}?flow=requestVisit`} />;
};

export default AuthPage;
