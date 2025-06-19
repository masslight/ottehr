import { useAuth0 } from '@auth0/auth0-react';
import { Operation } from 'fast-json-patch';
import { Practitioner } from 'fhir/r4b';
import { DateTime, Duration } from 'luxon';
import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery } from 'react-query';
import {
  getFullestAvailableName,
  getPatchOperationForNewMetaTag,
  getPractitionerNPIIdentifier,
  initialsFromName,
  PROJECT_NAME,
  RoleType,
  SyncUserResponse,
  User,
} from 'utils';
import { create } from 'zustand';
import { getUser } from '../api/api';
import { useApiClients } from './useAppClients';
import { useAuthToken } from './useAuthToken';

export interface EvolveUser extends User {
  userName: string;
  userInitials: string;
  lastLogin: string | undefined;
  hasRole: (role: RoleType[]) => boolean;
}

interface EvolveUserState {
  user?: User;
  profile?: Practitioner;
}

const useEvolveUserStore = create<EvolveUserState>()(() => ({}));

// extracting it here, cause even if we use store - it will still initiate requests as much as we have usages of this hook,
// so just to use this var as a synchronization mechanism - lifted it here
let _practitionerLoginUpdateStarted = false;

export default function useEvolveUser(): EvolveUser | undefined {
  const { oystehr } = useApiClients();
  const user = useEvolveUserStore((state) => state.user);
  const profile = useEvolveUserStore((state) => state.profile);
  const { user: auth0User } = useAuth0();

  const isProviderHasEverythingToBeEnrolled = Boolean(
    profile?.id &&
      profile?.telecom?.find((phone) => phone.system === 'sms' || phone.system === 'phone')?.value &&
      getPractitionerNPIIdentifier(profile)?.value &&
      profile?.name?.[0]?.given?.[0] &&
      profile?.name?.[0]?.family
  );

  const userRoles = user?.roles;
  const hasRole = useCallback(
    (role: RoleType[]): boolean => {
      return userRoles?.find((r) => role.includes(r.name as RoleType)) != undefined;
    },
    [userRoles]
  );

  useGetUser();
  useSyncPractitioner((data) => {
    if (data.updated) {
      console.log('Practitioner sync success');
    }
  });
  const { refetch: refetchProfile } = useGetProfile();
  const { isLoading: isPractitionerLastLoginBeingUpdated, mutateAsync: mutatePractitionerAsync } =
    useUpdatePractitioner();

  useEffect(() => {
    if (user?.profile && !profile) {
      void refetchProfile();
    }
  }, [profile, refetchProfile, user?.profile]);

  useEffect(() => {
    if (user && oystehr && profile && !isPractitionerLastLoginBeingUpdated && !_practitionerLoginUpdateStarted) {
      _practitionerLoginUpdateStarted = true;
      void mutatePractitionerAsync([
        getPatchOperationForNewMetaTag(profile!, {
          system: 'last-login',
          code: DateTime.now().toISO() ?? 'Unknown',
        }),
      ]).catch(console.error);
    }
  }, [oystehr, isPractitionerLastLoginBeingUpdated, mutatePractitionerAsync, profile, user]);

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
      const userName = getFullestAvailableName(profile) ?? `${PROJECT_NAME} Team`;
      const userInitials = initialsFromName(userName);
      const lastLogin = profile.meta?.tag?.find((tag) => tag.system === 'last-login')?.code;
      return { userName, userInitials, lastLogin };
    }
    return { userName: `${PROJECT_NAME} team`, userInitials: initialsFromName(`${PROJECT_NAME} Team`) };
  }, [profile]);

  return useMemo(() => {
    if (user) {
      return {
        ...user,
        userName,
        userInitials,
        lastLogin,
        profileResource: profile,
        isProviderHasEverythingToBeEnrolled,
        hasRole,
      };
    }
    return undefined;
  }, [hasRole, isProviderHasEverythingToBeEnrolled, lastLogin, profile, user, userInitials, userName]);
}

// const MINUTE = 1000 * 60; // For Credentials Sync
// const DAY = MINUTE * 60 * 24; // For Credentials Sync

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const useGetUser = () => {
  const token = useAuthToken();
  const user = useEvolveUserStore((state) => state.user);

  return useQuery(
    ['get-user'],
    async (): Promise<void> => {
      try {
        const user = await getUser(token!);
        useEvolveUserStore.setState({ user: user as User });
      } catch (error) {
        console.error(error);
      }
    },
    {
      enabled: Boolean(token && !user),
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const useGetProfile = () => {
  const token = useAuthToken();
  const user = useEvolveUserStore((state) => state.user);
  const { oystehr } = useApiClients();

  return useQuery(
    ['get-practitioner-profile'],
    async (): Promise<void> => {
      try {
        if (!user?.profile) {
          useEvolveUserStore.setState({ profile: undefined });
          return;
        }

        const [resourceType, resourceId] = (user?.profile || '').split('/');
        if (resourceType && resourceId && resourceType === 'Practitioner') {
          const practitioner = await oystehr?.fhir.get<Practitioner>({ resourceType, id: resourceId });
          useEvolveUserStore.setState({ profile: practitioner });
        }
      } catch (e) {
        console.error(`error fetching user's fhir profile: ${JSON.stringify(e)}`);
        useEvolveUserStore.setState({ profile: undefined });
      }
    },
    {
      enabled: Boolean(token && oystehr),
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const useSyncPractitioner = (_onSuccess: (data: SyncUserResponse) => void) => {
  // console.log('Credentials sync is not enabled');
  /**
   * Credentials sync functionality -- Uncomment if you are synchronizing credentials from an external system
  
  const client = useZapEHRAPIClient();
  const token = useAuthToken();
  const { oystehr } = useApiClients();
  const queryClient = useQueryClient();
  return useQuery(
    ['sync-user', oystehr],
    async () => {
      if (!client) return undefined;
      _practitionerSyncStarted = true;
      const result = await client?.syncUser();
      _practitionerSyncFinished = true;
      if (result.updated) {
        void queryClient.refetchQueries('get-practitioner-profile');
      } else {
        useEvolveUserStore.setState((state) => ({ profile: { ...(state.profile! || {}) } }));
      }
      return result;
    },
    {
      onSuccess,
      cacheTime: DAY,
      staleTime: DAY,
      enabled: Boolean(token && oystehr && oystehr.config.accessToken && !_practitionerSyncStarted),
    }
  );
  */
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const useUpdatePractitioner = () => {
  const user = useEvolveUserStore((state) => state.user);
  const { oystehr } = useApiClients();

  return useMutation(
    ['update-practitioner'],
    async (patchOps: Operation[]): Promise<void> => {
      try {
        if (!oystehr || !user) return;

        await oystehr.fhir.patch({
          resourceType: 'Practitioner',
          id: user.profile.replace('Practitioner/', ''),
          operations: [...patchOps],
        });
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    { retry: 3 }
  );
};
