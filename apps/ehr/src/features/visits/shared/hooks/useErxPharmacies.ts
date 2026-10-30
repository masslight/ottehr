import { useQueries, useQuery, UseQueryResult } from '@tanstack/react-query';
import { searchPharmacyDirectory } from 'src/api/api';
import { useAuthToken } from 'src/hooks/useAuthToken';
import {
  directoryPharmacyToResult,
  directoryQueryForPlace,
  matchDirectoryPharmacy,
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

/** The directory pharmacy at a place, if one matches and can be ordered to. */
const findDirectoryPharmacy = async (
  token: string,
  place: PharmacyPlace
): Promise<PharmacySearchResult | undefined> => {
  const query = directoryQueryForPlace(place);
  if (!query) return undefined;
  const row = matchDirectoryPharmacy(place, await searchPharmacyDirectory(token, query));
  return row && directoryPharmacyToResult(row);
};

export interface CheckedPlace {
  name: string;
  zipCode?: string;
  /** Undefined when the place isn't a directory pharmacy that takes e-prescriptions. */
  pharmacy?: PharmacySearchResult;
}

/** A Google place checked against the directory: its details give its address parts, which are matched there. */
const checkPlace = async (token: string, searchPlaces: SearchPlaces, placesId: string): Promise<CheckedPlace> => {
  const [details] = (await searchPlaces({ placesId })).pharmacyPlaces;
  const name = details?.name ?? '';
  const parts = details?.addressComponents;
  if (!parts) return { name };
  const pharmacy = await findDirectoryPharmacy(token, { name, ...parts });
  return { name, zipCode: parts.zipCode?.slice(0, 5), pharmacy };
};

/** The check of a picked Google place; undefined until the clients are ready. */
export const useCheckPlace = (): ((placesId: string) => Promise<CheckedPlace>) | undefined => {
  const token = useAuthToken();
  const apiClient = useOystehrAPIClient();
  return token && apiClient ? (placesId) => checkPlace(token, apiClient.searchPlaces, placesId) : undefined;
};

/** Google's suggestions for what's typed. */
export const usePharmacyPlaces = (query: string): UseQueryResult<PlacesResult[], Error> => {
  const apiClient = useOystehrAPIClient();
  return useQuery({
    queryKey: ['erx-pharmacy-places', query],
    queryFn: async () => (await apiClient!.searchPlaces({ searchTerm: query })).pharmacyPlaces,
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

/** The patient's saved pharmacy as a directory pharmacy, matched once per patient: by its Google place when it was
 * picked with Google, else by its saved address. Null when it matches none that takes e-prescriptions. */
export const usePreferredPharmacy = (
  patientId: string | undefined,
  saved: PharmacyDTO | undefined
): UseQueryResult<PharmacySearchResult | null, Error> => {
  const token = useAuthToken();
  const apiClient = useOystehrAPIClient();
  return useQuery({
    queryKey: ['erx-preferred-pharmacy', patientId, saved],
    queryFn: async () => {
      if (saved!.placesId) return (await checkPlace(token!, apiClient!.searchPlaces, saved!.placesId)).pharmacy ?? null;
      const place = parseAddressText(saved!.name, saved!.address);
      return (place && (await findDirectoryPharmacy(token!, place))) ?? null;
    },
    enabled: Boolean(token) && Boolean(apiClient) && Boolean(saved),
    staleTime: Infinity,
  });
};
