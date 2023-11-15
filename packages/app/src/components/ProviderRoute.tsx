import { useAuth0 } from '@auth0/auth0-react';
import React from 'react';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loginWithRedirect, isLoading } = useAuth0();

  if (!isAuthenticated && !isLoading) {
    loginWithRedirect().catch((error: Error) => {
      throw new Error(`Error calling loginWithRedirect Auth0: ${error.message}`);
    });
  }

  return children;
};

export default PrivateRoute;
