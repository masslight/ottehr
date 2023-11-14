import { useAuth0 } from '@auth0/auth0-react';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loginWithRedirect, isLoading } = useAuth0();

  if (!isAuthenticated && !isLoading) {
    loginWithRedirect().catch((error) => {
      throw new Error(`Error calling loginWithRedirect Auth0 ${error}`);
    });
  }

  return children;
};

export default PrivateRoute;
