import { useAuth0 } from '@auth0/auth0-react';
import { FC, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { IntakeFlowPageRoute } from '../App';
import { ErrorFallbackScreen, LoadingScreen } from '../features/common';

const AuthPage: FC = () => {
  const { isAuthenticated, loginWithRedirect, isLoading, error, user } = useAuth0();
  const authRef = useRef<Promise<void> | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const welcomePath = searchParams.get('flow') === 'welcome';

  if (error) {
    return <ErrorFallbackScreen />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    if (!authRef.current) {
      authRef.current = loginWithRedirect({
        appState: { welcomePath },
      });
    }
    return <LoadingScreen />;
  }

  console.log('user appState', user?.appState?.welcomePath);

  const appState = user?.appState || {};
  const redirectToWelcome = appState.welcomePath || welcomePath;

  if (redirectToWelcome) {
    return <Navigate to={`${IntakeFlowPageRoute.SelectPatient.path}?flow=requestVisit`} />;
  }

  return <Navigate to={IntakeFlowPageRoute.PatientPortal.path} />;
};

export default AuthPage;
