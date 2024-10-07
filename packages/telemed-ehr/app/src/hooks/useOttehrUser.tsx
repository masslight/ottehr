import { useAuth0 } from '@auth0/auth0-react';
import { ClientConfig, FhirClient } from '@zapehr/sdk';
import { Practitioner } from 'fhir/r4';
import { DateTime, Duration } from 'luxon';
import { useEffect, useMemo } from 'react';
import { useQuery } from 'react-query';
import { User, getFullestAvailableName, getPatchOperationForNewMetaTag, initialsFromName } from 'ehr-utils';
import { create } from 'zustand';
import { getUser } from '../api/api';
import { useZapEHRAPIClient } from '../telemed/hooks/useZapEHRAPIClient';
import { RoleType } from '../types/types';
import { useApiClients } from './useAppClients';
import { useAuthToken } from './useAuthToken';

export interface OttehrUser extends User {
  userName: string;
  userInitials: string;
  lastLogin: string | undefined;
  hasRole: (role: RoleType[]) => boolean;
}

interface OttehrUserState {
  user?: User;
  profile?: Practitioner;
}

const useOttehrUserStore = create<OttehrUserState>()(() => ({}));

enum LoadingState {
  initial,
  pending,
  idle,
}

// extracting it here, cause even if we use store - it will still initiate requests as much as we have usages of this hook,
// so just to use this var as a synchronization mechanism - lifted it here
let _profileLoadingState = LoadingState.initial;
let _lastLoginUpdating = LoadingState.initial;
let _userLoading = LoadingState.initial;

export default function useOttehrUser(): OttehrUser | undefined {
  const { fhirClient } = useApiClients();
  const { isAuthenticated, getAccessTokenSilently, user: auth0User } = useAuth0();
  const user = useOttehrUserStore((state) => state.user);
  const profile = useOttehrUserStore((state) => state.profile);

  useEffect(() => {
    async function getUserRequest(): Promise<void> {
      try {
        _userLoading = LoadingState.pending;
        const accessToken = await getAccessTokenSilently();
        const user = await getUser(accessToken);
        useOttehrUserStore.setState({ user: user as User });
        _userLoading = LoadingState.idle;
      } catch (error) {
        console.error(error);
        _userLoading = LoadingState.initial;
      }
    }

    if (isAuthenticated && !user && _userLoading === LoadingState.initial) {
      void getUserRequest();
    }
  }, [getAccessTokenSilently, isAuthenticated, user]);

  useEffect(() => {
    const fetchFhirProfile = async (profileRef: string, client: FhirClient): Promise<void> => {
      try {
        _profileLoadingState = LoadingState.pending;
        const [resourceType, resourceId] = profileRef.split('/');
        if (resourceType && resourceId && resourceType === 'Practitioner') {
          const practitioner = await client.readResource<Practitioner>({ resourceType, resourceId });
          useOttehrUserStore.setState({ profile: practitioner });
          console.log('practitioner', practitioner);
        }
        _profileLoadingState = LoadingState.idle;
      } catch (e) {
        console.error(`error fetching user's fhir profile: ${JSON.stringify(e)}`);
        useOttehrUserStore.setState({ profile: undefined });
        _profileLoadingState = LoadingState.initial;
      }
    };
    if (fhirClient && _profileLoadingState === LoadingState.initial && user?.profile && !profile) {
      void fetchFhirProfile(user.profile, fhirClient);
    } else if (!user?.profile) {
      useOttehrUserStore.setState({ profile: undefined });
    }
  }, [fhirClient, profile, user]);

  useEffect(() => {
    async function updateLastLogin(user: User, fhirClient: FhirClient): Promise<void> {
      _lastLoginUpdating = LoadingState.pending;
      try {
        await fhirClient.patchResource({
          resourceType: 'Practitioner',
          resourceId: user.profile.replace('Practitioner/', ''),
          operations: [
            getPatchOperationForNewMetaTag(profile!, {
              system: 'last-login',
              code: DateTime.now().toISO() ?? 'Unknown',
            }),
          ],
        });
      } catch (error) {
        console.log(error);
      } finally {
        _lastLoginUpdating = LoadingState.idle;
      }
    }

    if (user && fhirClient && profile && _lastLoginUpdating !== LoadingState.pending) {
      void updateLastLogin(user, fhirClient);
    }
  }, [fhirClient, profile, user]);

  useEffect(() => {
    const lastLogin = auth0User?.updated_at;
    if (lastLogin) {
      const loginTime = DateTime.fromISO(lastLogin);
      if (Math.abs(loginTime.diffNow('seconds').seconds) <= Duration.fromObject({ seconds: 5 }).seconds) {
        localStorage.removeItem('selectedDate');
      }
    }
  }, [auth0User?.updated_at]);

  const { userName, userInitials, lastLogin } = useMemo(() => {
    if (profile) {
      const userName = getFullestAvailableName(profile) ?? 'Ottehr Team';
      const userInitials = initialsFromName(userName);
      const lastLogin = profile.meta?.tag?.find((tag) => tag.system === 'last-login')?.code;
      return { userName, userInitials, lastLogin };
    }
    return { userName: 'Ottehr Team', userInitials: initialsFromName('Ottehr Team') };
  }, [profile]);

  return useMemo(() => {
    if (user) {
      const userRoles = user.roles;
      return {
        ...user,
        userName,
        userInitials,
        lastLogin,
        profileResource: profile,
        hasRole: (role: RoleType[]) => {
          return userRoles.find((r) => role.includes(r.name as RoleType)) != undefined;
        },
      };
    }
    return undefined;
  }, [lastLogin, profile, user, userInitials, userName]);
}

const MINUTE = 1000 * 60;
const DAY = MINUTE * 60 * 24;
