import Oystehr from '@oystehr/sdk';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { RoleType, User } from 'utils';
import { useAuthToken } from './useAuthToken';

export interface BillingUser extends User {
  hasRole: (roles: RoleType[]) => boolean;
}

export function useEvolveUser(): { currentUser: BillingUser | undefined; isLoadingUser: boolean } {
  const token = useAuthToken();

  const queryResult: UseQueryResult<User, Error> = useQuery({
    queryKey: ['billing-get-user'],
    enabled: Boolean(token),
    queryFn: async (): Promise<User> => {
      const oystehr = new Oystehr({
        accessToken: token!,
        projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
      });
      return oystehr.user.me();
    },
  });

  const hasRole = useCallback(
    (roles: RoleType[]): boolean => {
      return queryResult.data?.roles?.some((role) => roles.includes(role.name as RoleType)) ?? false;
    },
    [queryResult.data?.roles]
  );

  const currentUser = useMemo(() => {
    if (!queryResult.data) return undefined;
    return {
      ...queryResult.data,
      hasRole,
    };
  }, [hasRole, queryResult.data]);

  return {
    currentUser,
    isLoadingUser: Boolean(token) && queryResult.isPending,
  };
}
