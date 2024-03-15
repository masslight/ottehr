import { useAuth0 } from '@auth0/auth0-react';
import { User } from '@zapehr/sdk';
import { useEffect } from 'react';
import { getUser } from '../api/api';
import { useCommonStore } from '../state/common.store';

export function useGetUser(): User | undefined {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const user = useCommonStore((state) => state.user);

  useEffect(() => {
    async function getUserRequest(): Promise<void> {
      const accessToken = await getAccessTokenSilently();
      const user = await getUser(accessToken);
      useCommonStore.setState({ user });
    }

    if (isAuthenticated && !user) {
      getUserRequest().catch((error) => {
        console.error(error);
      });
    }
  }, [getAccessTokenSilently, isAuthenticated, user]);

  return user;
}
