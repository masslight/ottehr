import { useAuth0 } from '@auth0/auth0-react';
import { ReactElement } from 'react';
import { redirect } from 'react-router-dom';

export default function Logout(): ReactElement {
  const { isAuthenticated, logout } = useAuth0();

  if (!isAuthenticated) {
    redirect('/');
  }
  void logout({
    returnTo: import.meta.env.VITE_APP_ZAPEHR_APPLICATION_REDIRECT_URL,
    federated: true,
  });

  return <></>;
}
