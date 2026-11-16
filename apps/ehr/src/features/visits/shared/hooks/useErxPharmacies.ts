import { useQueries, useQuery, UseQueryResult } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { searchPharmacyDirectory } from 'src/api/api';
import { useAuthToken } from 'src/hooks/useAuthToken';
import {
  directoryPharmacyMatches,
  directoryPharmacyToResult,
  directoryQueryForPlace,
  parseAddressText,
  PharmacyPlace,
} from 'utils/lib/helpers/erx-pharmacy-match';
import { PharmacyDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ErxDirectoryPharmacy, ErxDirectoryQuery, PharmacySearchResult } from 'utils/lib/types/api/erx-search.types';
import { PlacesResult, SearchPlacesInput, SearchPlacesOutput } from 'utils/lib/types/data/search-places';
import { useOystehrAPIClient } from './useOystehrAPIClient';

// As the patient paperwork's Google search: it searches from the third character.
const MIN_PLACES_QUERY_LENGTH = 3;

type SearchPlaces = (input: SearchPlacesInput) => Promise<SearchPlacesOutput>;

/** The directory pharmacies at a place. */
const findDirectoryPharmacies = async (token: string, place: PharmacyPlace): Promise<ErxDirectoryPharmacy[]> => {
  const query = directoryQueryForPlace(place);
  return query ? directoryPharmacyMatches(place, await searchPharmacyDirectory(token, query)) : [];
};

/** The one directory pharmacy matched, if it can be ordered to: none when several match (ambiguous). */
const onlyPharmacy = (matches: ErxDirectoryPharmacy[]): PharmacySearchResult | undefined =>
  matches.length === 1 ? directoryPharmacyToResult(matches[0]) : undefined;

export interface CheckedPlace {
  name: string;
  zipCode?: string;
  /** Undefined when the place isn't a directory pharmacy that takes e-prescriptions. */
  pharmacy?: PharmacySearchResult;
  /** More than one directory pharmacy matches the place, so which one it is can't be told. */
  several?: boolean;
}

/** A Google place checked against the directory: its details give its address parts, which are matched there. */
const checkPlace = async (token: string, searchPlaces: SearchPlaces, placesId: string): Promise<CheckedPlace> => {
  const [details] = (await searchPlaces({ placesId, skipErxMatch: true })).pharmacyPlaces;
  const name = details?.name ?? '';
  const parts = details?.addressComponents;
  if (!parts) return { name };
  const matches = await findDirectoryPharmacies(token, { name, ...parts });
  return { name, zipCode: parts.zipCode?.slice(0, 5), pharmacy: onlyPharmacy(matches), several: matches.length > 1 };
};

/** The check of a picked Google place; undefined until the clients are ready. */
export const useCheckPlace = (): ((placesId: string) => Promise<CheckedPlace>) | undefined => {
  const token = useAuthToken();
  const apiClient = useOystehrAPIClient();
  return token && apiClient ? (placesId) => checkPlace(token, apiClient.searchPlaces, placesId) : undefined;
};

type Location = NonNullable<SearchPlacesInput['locationBias']>;

/** The browser's location, as the patient paperwork's Google search asks for it; undefined when denied. */
const useBrowserLocation = (): Location | undefined => {
  const [location, setLocation] = useState<Location>();
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => setLocation({ latitude: coords.latitude, longitude: coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);
  return location;
};

/** Google's suggestions for what's typed, nearest the browser's location first. */
export const usePharmacyPlaces = (query: string): UseQueryResult<PlacesResult[], Error> => {
  const apiClient = useOystehrAPIClient();
  const locationBias = useBrowserLocation();
  return useQuery({
    queryKey: ['erx-pharmacy-places', query, locationBias],
    queryFn: async () =>
      (await apiClient!.searchPlaces({ searchTerm: query, locationBias, pharmaciesOnly: true })).pharmacyPlaces,
    enabled: Boolean(apiClient) && query.trim().length >= MIN_PLACES_QUERY_LENGTH,
  });
};

/** The directory pharmacies for a query that an order can go to (those with an NPI); nothing without a query. */
export const usePharmacyDirectory = (
  query: ErxDirectoryQuery | undefined
): UseQueryResult<PharmacySearchResult[], Error> => {
  const token = useAuthToken();
  return useQuery({
    queryKey: ['erx-pharmacy-directory', query],
    queryFn: async () =>
      (await searchPharmacyDirectory(token!, query!)).flatMap((row) => directoryPharmacyToResult(row) ?? []),
    enabled: Boolean(token) && Boolean(query),
  });
};

/** Each NCPDP ID's directory row; none when it no longer takes e-prescriptions. */
export const usePharmaciesByNcpdpId = (
  ncpdpIds: string[]
): { ncpdpId: string; row?: ErxDirectoryPharmacy; status: 'pending' | 'error' | 'success' }[] => {
  const token = useAuthToken();
  const results = useQueries({
    queries: ncpdpIds.map((ncpdpId) => ({
      queryKey: ['erx-pharmacy-by-ncpdp-id', ncpdpId],
      queryFn: async () => (await searchPharmacyDirectory(token!, { ncpdpId }))[0] ?? null,
      enabled: Boolean(token),
      staleTime: Infinity,
    })),
  });
  return ncpdpIds.map((ncpdpId, i) => ({
    ncpdpId,
    row: results[i]?.data ?? undefined,
    status: results[i]?.status ?? 'pending',
  }));
};

/** A saved pharmacy that more than one directory pharmacy matches, so which one it is can't be told: its zip. */
export interface SeveralPreferred {
  several: true;
  zipCode?: string;
}

/** The patient's saved pharmacy as a directory pharmacy, matched once per patient: by its Google place when it was
 * picked with Google, else by its saved address. Null when it matches none that takes e-prescriptions. */
export const usePreferredPharmacy = (
  patientId: string | undefined,
  saved: PharmacyDTO | undefined
): UseQueryResult<PharmacySearchResult | SeveralPreferred | null, Error> => {
  const token = useAuthToken();
  const apiClient = useOystehrAPIClient();
  return useQuery({
    queryKey: ['erx-preferred-pharmacy', patientId, saved],
    queryFn: async () => {
      if (saved!.placesId) {
        const { pharmacy, several, zipCode } = await checkPlace(token!, apiClient!.searchPlaces, saved!.placesId);
        return several ? { several: true as const, zipCode } : pharmacy ?? null;
      }
      const place = parseAddressText(saved!.name, saved!.address);
      const matches = place ? await findDirectoryPharmacies(token!, place) : [];
      return matches.length > 1 ? { several: true as const, zipCode: place?.zipCode } : onlyPharmacy(matches) ?? null;
    },
    enabled: Boolean(token) && Boolean(apiClient) && Boolean(saved),
    staleTime: Infinity,
  });
};
