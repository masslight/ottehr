import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { checkPractitionerEnrollment } from 'src/api/api';
import { useAuthToken } from 'src/hooks/useAuthToken';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { CheckPractitionerEnrollmentOutput } from 'utils/lib/types/api/practitioner-enrollment.types';

export const useCheckSurescriptsEnrollment = (): UseQueryResult<CheckPractitionerEnrollmentOutput, Error> => {
  const token = useAuthToken();
  const user = useEvolveUser();
  const practitionerId = user?.profileResource?.id;

  return useQuery({
    queryKey: ['surescripts-practitioner-enrollment', practitionerId],
    queryFn: () => {
      if (!token || !practitionerId) {
        throw new Error('API client not available');
      }
      return checkPractitionerEnrollment(token, practitionerId);
    },
    enabled: !!token && !!practitionerId,
  });
};
