import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { GetLocationSupportPhonesOutput } from 'utils';
import { getPublicLocationSupportPhones } from '../api/api';
import { useApiClients } from './useAppClients';

export function useLocationSupportPhones(): UseQueryResult<GetLocationSupportPhonesOutput> {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: ['location-support-phones'],
    queryFn: () => getPublicLocationSupportPhones(oystehrZambda!),
    enabled: !!oystehrZambda,
    staleTime: 5 * 60_000,
  });
}

export function useSupportPhonesMap(): { phonesByLocationName: Record<string, string> } {
  const { data } = useLocationSupportPhones();
  if (!data) return { phonesByLocationName: {} };
  const phonesByLocationName: Record<string, string> = {};
  for (const entry of data.locations) {
    phonesByLocationName[entry.locationName] = entry.phoneNumber;
  }
  return { phonesByLocationName };
}
