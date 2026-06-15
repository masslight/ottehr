import { useAuth0 } from '@auth0/auth0-react';
import { ReactElement, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { SESSION_STORAGE_DATE_KEY, SESSION_STORAGE_DATE_RANGE_KEY } from 'src/components/AppointmentsFilters';

// sessionStorage survives the same-tab logout -> Auth0 round-trip, so the date has to be
// cleared explicitly here for it to default back to today on the next login.
function clearPersistedDate(): void {
  sessionStorage.removeItem(SESSION_STORAGE_DATE_RANGE_KEY);
  sessionStorage.removeItem(SESSION_STORAGE_DATE_KEY);
}

export default function Logout(): ReactElement {
  const { isAuthenticated, isLoading, logout } = useAuth0();

  useEffect(() => {
    // Auto-logout navigates here via a full page reload, so wait for Auth0 to rehydrate the
    // session before acting — otherwise isAuthenticated is briefly false and we'd skip cleanup.
    if (isLoading || !isAuthenticated) {
      return;
    }
    clearPersistedDate();
    void logout({
      logoutParams: { returnTo: import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL, federated: true },
    });
  }, [isAuthenticated, isLoading, logout]);

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <></>;
}
