import { useAuth0 } from '@auth0/auth0-react';
import { FC } from 'react';
import { Outlet } from 'react-router-dom';

export const ProtectedRoute: FC<{
  loadingFallback: JSX.Element;
  errorFallback: JSX.Element;
  unauthorizedFallback: JSX.Element;
}> = ({ loadingFallback, errorFallback, unauthorizedFallback }) => {
  const { isAuthenticated, isLoading, error } = useAuth0();

  if (error) {
    return errorFallback;
  }

  if (isLoading) {
    return loadingFallback;
  }

  if (!isAuthenticated) {
    return unauthorizedFallback;
  }

  return <Outlet />;
};
