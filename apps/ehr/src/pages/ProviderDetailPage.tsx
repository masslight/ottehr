import { Box, CircularProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ReactElement } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { getEmployees } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';

/**
 * Entry point for a provider keyed by their Practitioner id — the id the
 * Schedules list carries for provider rows. The list no longer resolves each
 * provider's Oystehr User id up front (that meant scanning every project user,
 * the endpoint's slowest call); instead we resolve it here, on demand, and hand
 * off to the existing employee editor, which is the provider detail UI today.
 *
 * Keeping this as a distinct `/admin/provider/:practitionerId` route gives us a
 * stable, provider-centric seam to grow into a first-class provider page later
 * without the Schedules list needing to know a provider's User id.
 */
export default function ProviderDetailPage(): ReactElement {
  const { practitionerId } = useParams();
  const location = useLocation();
  const { oystehrZambda } = useApiClients();

  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => (oystehrZambda ? getEmployees(oystehrZambda) : null),
    enabled: !!oystehrZambda,
  });

  const userId = data?.employees.find((e) => e.profile.split('/')[1] === practitionerId)?.id;

  if (isLoading || !oystehrZambda) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (userId) {
    // Preserve the incoming hash (e.g. `#schedule`) so the caller can deep-link
    // straight to the schedule section of the employee page.
    return <Navigate to={`/admin/employee/${userId}${location.hash}`} replace />;
  }

  return (
    <Box sx={{ mt: 8, textAlign: 'center' }}>
      <Typography variant="h6">Provider not found</Typography>
      <Typography color="text.secondary">
        No user account is associated with this provider, so it can&apos;t be managed here.
      </Typography>
    </Box>
  );
}
