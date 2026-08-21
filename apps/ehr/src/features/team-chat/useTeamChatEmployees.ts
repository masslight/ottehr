import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getEmployees } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { TeamChatMention } from './team-chat.store';

// Every active employee is mentionable — unlike the assignment lists, customer
// support and non-providers are included.
export const useTeamChatEmployees = (options?: { enabled?: boolean }): UseQueryResult<TeamChatMention[] | null> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['team-chat-employees'],
    queryFn: async (): Promise<TeamChatMention[] | null> => {
      if (!oystehrZambda) return null;
      const response = await getEmployees(oystehrZambda, { lite: true });
      return response.employees
        .filter((employee) => employee.status === 'Active')
        .map((employee) => ({
          profile: employee.profile,
          name: `${employee.firstName} ${employee.lastName}`.trim() || employee.name,
        }))
        .filter((candidate) => candidate.name !== '' && candidate.profile.startsWith('Practitioner/'))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!oystehrZambda && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
};
