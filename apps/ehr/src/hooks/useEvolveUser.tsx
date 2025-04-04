import { useAuth0 } from '@auth0/auth0-react';
import { Operation } from 'fast-json-patch';
import { Practitioner } from 'fhir/r4b';
import { DateTime, Duration } from 'luxon';
import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import {
  PHOTON_PRACTITIONER_ENROLLED,
  PHOTON_PRESCRIBER_SYSTEM_URL,
  RoleType,
  SyncUserResponse,
  User,
  getFullestAvailableName,
  getPatchOperationForNewMetaTag,
  getPatchOperationToUpdateExtension,
  getPractitionerNPIIdentitifier,
  initialsFromName,
} from 'utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUser } from '../api/api';
import { useZapEHRAPIClient } from '../telemed/hooks/useOystehrAPIClient';
import { useApiClients } from './useAppClients';
import { useAuthToken } from './useAuthToken';

export interface EvolveUser extends User {
  userName: string;
  userInitials: string;
  lastLogin: string | undefined;
  hasRole: (role: RoleType[]) => boolean;
  isPhotonPrescriber?: boolean;
  isPractitionerEnrolledInPhoton?: boolean;
}

interface EvolveUserState {
  user?: User;
  profile?: Practitioner;
}

const useEvolveUserStore = create<EvolveUserState>()(() => ({}));

export const useProviderPhotonStateStore = create<{
  wasEnrolledInphoton?: boolean;
}>()(persist(() => ({}), { name: 'ottehr-ehr-provider-erx-store' }));

// extracting it here, cause even if we use store - it will still initiate requests as much as we have usages of this hook,
// so just to use this var as a synchronization mechanism - lifted it here
let _practitionerLoginUpdateStarted = false;
let _practitionerSyncStarted = false;
let _practitionerSyncFinished = false;
let _practitionerERXEnrollmentStarted = false;

export default function useEvolveUser(): EvolveUser | undefined {
  const { oystehr } = useApiClients();
  const user = useEvolveUserStore((state) => state.user);
  const profile = useEvolveUserStore((state) => state.profile);
  const { user: auth0User } = useAuth0();
  const isPhotonPrescriber = profile?.identifier?.some(
    (x) => x.system === PHOTON_PRESCRIBER_SYSTEM_URL && Boolean(x.value)
  );
  const isPractitionerEnrolledInPhoton = profile?.extension?.some(
    (x) => x.url === PHOTON_PRACTITIONER_ENROLLED && Boolean(x.valueBoolean)
  );

  useEffect(() => {
    if (isPractitionerEnrolledInPhoton) {
      useProviderPhotonStateStore.setState({ wasEnrolledInphoton: true });
    }
  }, [isPractitionerEnrolledInPhoton]);

  const isProviderHasEverythingToBeEnrolled = Boolean(
    profile?.id &&
      profile?.telecom?.find((phone) => phone.system === 'sms' || phone.system === 'phone')?.value &&
      getPractitionerNPIIdentitifier(profile)?.value &&
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
  const { mutateAsync: mutateEnrollPractitionerInERX } = useEnrollPractitionerInERX();

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

  useEffect(() => {
    if (
      !isPractitionerEnrolledInPhoton &&
      hasRole([RoleType.Provider]) &&
      _practitionerSyncFinished &&
      isProviderHasEverythingToBeEnrolled &&
      !_practitionerERXEnrollmentStarted
    ) {
      _practitionerERXEnrollmentStarted = true;
      mutateEnrollPractitionerInERX()
        .then(async () => {
          if (profile) {
            const op = getPatchOperationToUpdateExtension(profile, {
              url: PHOTON_PRACTITIONER_ENROLLED,
              valueBoolean: true,
            });
            if (op) {
              await mutatePractitionerAsync([op]);
              void refetchProfile();
            }
          }
        })
        .catch(console.error);
    }
  }, [
    hasRole,
    isPractitionerEnrolledInPhoton,
    isProviderHasEverythingToBeEnrolled,
    mutateEnrollPractitionerInERX,
    mutatePractitionerAsync,
    profile,
    refetchProfile,
  ]);

  const { userName, userInitials, lastLogin } = useMemo(() => {
    if (profile) {
      const userName = getFullestAvailableName(profile) ?? 'Ottehr Team';
      const userInitials = initialsFromName(userName);
      const lastLogin = profile.meta?.tag?.find((tag) => tag.system === 'last-login')?.code;
      return { userName, userInitials, lastLogin };
    }
    return { userName: 'Ottehr team', userInitials: initialsFromName('Ottehr Team') };
  }, [profile]);

  return useMemo(() => {
    if (user) {
      return {
        ...user,
        userName,
        userInitials,
        lastLogin,
        profileResource: profile,
        isPhotonPrescriber,
        isPractitionerEnrolledInPhoton,
        hasRole,
      };
    }
    return undefined;
  }, [hasRole, isPhotonPrescriber, isPractitionerEnrolledInPhoton, lastLogin, profile, user, userInitials, userName]);
}

const MINUTE = 1000 * 60;
const DAY = MINUTE * 60 * 24;

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
const useSyncPractitioner = (onSuccess: (data: SyncUserResponse) => void) => {
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

interface StreetAddress {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postal_code: string;
}

interface ERXEnrollmentProps {
  providerId: Required<Practitioner['id']>;
  address: StreetAddress;
  npi?: string;
  phone: string;
  given_name: string;
  family_name: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const useEnrollPractitionerInERX = () => {
  const token = useAuthToken();
  const profile = useEvolveUserStore((state) => state.profile);

  return useMutation(
    ['enroll-provider-erx'],
    async (): Promise<void> => {
      try {
        const address: StreetAddress = {
          street1: '1 Hollow Lane',
          street2: 'Ste 301',
          city: 'Lake Success',
          postal_code: '11042',
          state: 'NY',
        };
        const payload: ERXEnrollmentProps = {
          providerId: profile?.id,
          address,
          phone: profile?.telecom?.find((phone) => phone.system === 'sms' || phone.system === 'phone')?.value || '',
          npi: profile && getPractitionerNPIIdentitifier(profile)?.value,
          given_name: profile?.name?.[0]?.given?.[0] || '',
          family_name: profile?.name?.[0]?.family || '',
        };
        _practitionerERXEnrollmentStarted = true;

        const response = await fetch(`${import.meta.env.VITE_APP_PROJECT_API_URL}/erx/enrollment`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
          method: 'POST',
        });
        if (!response.ok) {
          throw new Error(`ERX practitioner enrollment call failed: ${response.statusText}`);
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    { retry: 2 }
  );
};
