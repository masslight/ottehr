import Oystehr from '@oystehr/sdk';
import { useQuery } from '@tanstack/react-query';
import type { Location } from 'fhir/r4b';
import { useEffect } from 'react';
import {
  GetLocationSupportPhonesOutput,
  LOCATION_SUPPORT_PHONE_EXTENSION_URL,
  setLocationSupportPhoneOverrides,
} from 'utils';
import { useApiClients } from './useAppClients';

async function fetchPhonesViaFhir(oystehr: Oystehr): Promise<GetLocationSupportPhonesOutput> {
  const locations = (
    await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [{ name: '_count', value: '1000' }],
    })
  ).unbundle();

  const entries = locations
    .map((loc) => {
      const phoneNumber = loc.extension?.find((e) => e.url === LOCATION_SUPPORT_PHONE_EXTENSION_URL)?.valueString;
      if (!loc.id || !loc.name || !phoneNumber) return undefined;
      return { locationId: loc.id, locationName: loc.name, phoneNumber };
    })
    .filter((e): e is { locationId: string; locationName: string; phoneNumber: string } => e !== undefined);

  return { locations: entries };
}

export function useHydrateLocationSupportPhones(): void {
  const { oystehr } = useApiClients();

  const { data } = useQuery({
    queryKey: ['location-support-phones'],
    queryFn: () => fetchPhonesViaFhir(oystehr!),
    enabled: !!oystehr,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!data) return;
    const map: Record<string, string> = {};
    for (const entry of data.locations) {
      map[entry.locationName] = entry.phoneNumber;
    }
    setLocationSupportPhoneOverrides(map, data.defaultSupportPhoneNumber);
  }, [data]);
}
