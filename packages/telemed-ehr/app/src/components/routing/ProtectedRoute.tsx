import { useAuth0 } from '@auth0/auth0-react';
import { FC } from 'react';
import { Outlet } from 'react-router-dom';
import { LoadingScreen } from '../LoadingScreen';

export const ProtectedRoute: FC = () => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  if (!isAuthenticated && isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated && !isLoading) {
    loginWithRedirect().catch((error) => {
      throw new Error(`Error calling loginWithRedirect Auth0 ${error}`);
    });
  }

  return <Outlet />;
};
