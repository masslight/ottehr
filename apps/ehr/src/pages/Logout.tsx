import { useAuth0 } from '@auth0/auth0-react';
import { ReactElement, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { SESSION_STORAGE_DATE_RANGE_KEY } from 'src/components/AppointmentsFilters';
import { clearPersistedExports } from 'src/features/medical-record-export/store/medicalRecordExport.store';

function clearPersistedSessionState(): void {
  sessionStorage.removeItem(SESSION_STORAGE_DATE_RANGE_KEY);
  clearPersistedExports();
}

export default function Logout(): ReactElement {
  const { isAuthenticated, isLoading, logout } = useAuth0();

  useEffect(() => {
    // Auto-logout navigates here via a full page reload, so wait for Auth0 to rehydrate the
    // session before acting — otherwise isAuthenticated is briefly false and we'd skip cleanup.
    if (isLoading || !isAuthenticated) {
      return;
    }
    clearPersistedSessionState();
    void logout({
      logoutParams: { returnTo: import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL, federated: true },
    });
  }, [isAuthenticated, isLoading, logout]);

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <></>;
}
