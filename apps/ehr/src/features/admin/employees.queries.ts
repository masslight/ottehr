import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { GetUserResponse } from 'utils/lib/types/api/get-user.types';
import { getUserDetails } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';

export const EMPLOYEE_DETAILS_QUERY_KEY = 'employee-details';

/**
 * One employee's full record — the Oystehr user, their Practitioner profile, licenses, schedule id
 * and recent-activity flag.
 *
 * Keyed by user id so navigating between employees doesn't serve the previous one's record, and so
 * a save can invalidate exactly the record it changed.
 */
export const useGetEmployeeDetails = (userId: string | undefined): UseQueryResult<GetUserResponse | null, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: [EMPLOYEE_DETAILS_QUERY_KEY, userId],
    queryFn: () => (oystehrZambda && userId ? getUserDetails(oystehrZambda, { userId }) : null),
    enabled: !!oystehrZambda && !!userId,
  });
};
