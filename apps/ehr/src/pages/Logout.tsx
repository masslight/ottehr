import { useAuth0 } from '@auth0/auth0-react';
import { ReactElement } from 'react';
import { redirect } from 'react-router-dom';
import { LOCAL_STORAGE_FILTERS_KEY } from 'src/components/AppointmentsFilters';

export default function Logout(): ReactElement {
  const { isAuthenticated, logout } = useAuth0();

  if (!isAuthenticated) {
    redirect('/');
  }
  // Drop the persisted tracking board date so it defaults back to today on the next login.
  // Other filters are preserved.
  const persistedFilters = localStorage.getItem(LOCAL_STORAGE_FILTERS_KEY);
  if (persistedFilters) {
    const { date: _date, ...rest } = JSON.parse(persistedFilters);
    localStorage.setItem(LOCAL_STORAGE_FILTERS_KEY, JSON.stringify(rest));
  }
  void logout({
    logoutParams: { returnTo: import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL, federated: true },
  });

  return <></>;
}
