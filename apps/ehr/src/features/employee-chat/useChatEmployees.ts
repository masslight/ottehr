import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getEmployees } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';

export interface ChatEmployeeOption {
  profile: string;
  firstName: string;
  lastName: string;
  name: string;
}

export const useChatEmployees = (options: {
  enabled: boolean;
  myProfile: string | undefined;
}): UseQueryResult<ChatEmployeeOption[] | null> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['employee-chat-employees', options.myProfile],
    queryFn: async (): Promise<ChatEmployeeOption[] | null> => {
      if (!oystehrZambda) return null;
      const response = await getEmployees(oystehrZambda, { lite: true });
      return response.employees
        .filter(
          (employee) =>
            employee.status === 'Active' &&
            employee.profile.startsWith('Practitioner/') &&
            employee.profile !== options.myProfile
        )
        .map((employee) => ({
          profile: employee.profile,
          firstName: employee.firstName,
          lastName: employee.lastName,
          name: `${employee.firstName} ${employee.lastName}`.trim() || employee.name,
        }))
        .filter((employee) => employee.name !== '')
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!oystehrZambda && options.enabled,
    staleTime: 5 * 60 * 1000,
  });
};
