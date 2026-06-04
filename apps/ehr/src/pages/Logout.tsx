import { useAuth0 } from '@auth0/auth0-react';
import { ReactElement, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { LOCAL_STORAGE_FILTERS_KEY } from 'src/components/AppointmentsFilters';

// Drop the persisted tracking board date so it defaults back to today on the next login.
// Other filters are preserved. Guarded so a corrupted value can't break the logout flow.
function clearPersistedDate(): void {
  const persistedFilters = localStorage.getItem(LOCAL_STORAGE_FILTERS_KEY);
  if (!persistedFilters) {
    return;
  }
  try {
    const { date: _date, ...rest } = JSON.parse(persistedFilters);
    localStorage.setItem(LOCAL_STORAGE_FILTERS_KEY, JSON.stringify(rest));
  } catch {
    localStorage.removeItem(LOCAL_STORAGE_FILTERS_KEY);
  }
}

export default function Logout(): ReactElement {
  const { isAuthenticated, logout } = useAuth0();

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    clearPersistedDate();
    void logout({
      logoutParams: { returnTo: import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL, federated: true },
    });
  }, [isAuthenticated, logout]);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <></>;
}
