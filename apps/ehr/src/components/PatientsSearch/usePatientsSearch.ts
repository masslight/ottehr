import { useAuth0 } from '@auth0/auth0-react';
import { Bundle } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SEARCH_CONFIG } from './constants';
import {
  PartialSearchOptionsState,
  SearchOptionsFilters,
  SearchOptionsPagination,
  SearchOptionsSort,
  SearchOptionsState,
  SearchResult,
  SortField,
  SortOrder,
} from './types';
import { addSearchPagination } from './utils/addSearchPagination';
import { addSearchSort } from './utils/addSearchSort';
import { buildSearchQuery } from './utils/buildSearchQuery';
import { parseSearchResults } from './utils/parseSearchResults';

const emptySearchResult: SearchResult = {
  patients: [],
  pagination: { next: null, prev: null, totalItems: 0 },
};

const projectId = import.meta.env.VITE_APP_PROJECT_ID;

if (!projectId) {
  throw new Error('PROJECT_ID is not set');
}

const fetchPatients = async ({
  searchUrl,
  setSearchResult,
  setArePatientsLoading,
  getAccessTokenSilently,
}: {
  searchUrl: string;
  setSearchResult: React.Dispatch<React.SetStateAction<SearchResult>>;
  setArePatientsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  getAccessTokenSilently: () => Promise<string>;
}): Promise<void> => {
  setArePatientsLoading(true);
  try {
    const token = await getAccessTokenSilently();

    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-zapehr-project-id': projectId,
    };

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const patientBundle: Bundle = await response.json();
    const parsedSearchResult = parseSearchResults(patientBundle);
    setSearchResult(parsedSearchResult);
  } catch (error) {
    setSearchResult(emptySearchResult);
    const message = error instanceof Error ? error.message : 'An error occurred while searching';
    enqueueSnackbar(message, { variant: 'error' });
  } finally {
    setArePatientsLoading(false);
  }
};

const getFiltersFromUrl = (searchParams: URLSearchParams): SearchOptionsFilters => ({
  givenNames: searchParams.get('givenNames') || '',
  lastName: searchParams.get('lastName') || '',
  dob: searchParams.get('dob') || '',
  pid: searchParams.get('pid') || '',
  phone: searchParams.get('phone') || '',
  address: searchParams.get('address') || '',
  email: searchParams.get('email') || '',
  // subscriberNumber: searchParams.get('subscriberNumber') || '',
  status: (searchParams.get('status') as SearchOptionsFilters['status']) || 'All',
  location: searchParams.get('location') || 'All',
});

const getSortFromUrl = (searchParams: URLSearchParams): SearchOptionsSort => ({
  field: (searchParams.get('field') as SortField) || SEARCH_CONFIG.DEFAULT_SORT.field,
  order: (searchParams.get('order') as SortOrder) || SEARCH_CONFIG.DEFAULT_SORT.order,
});

const getPaginationFromUrl = (searchParams: URLSearchParams): SearchOptionsPagination => ({
  pageSize: Number(searchParams.get('pageSize')) || SEARCH_CONFIG.DEFAULT_PAGE_SIZE,
  offset: Number(searchParams.get('offset')) || 0,
});

const defaultSearchOptions: SearchOptionsState = {
  filters: {
    givenNames: '',
    lastName: '',
    dob: '',
    pid: '',
    phone: '',
    address: '',
    email: '',
    // subscriberNumber: '',
    status: 'All',
    location: 'All',
  },
  sort: SEARCH_CONFIG.DEFAULT_SORT,
  pagination: { pageSize: SEARCH_CONFIG.DEFAULT_PAGE_SIZE, offset: 0 },
};

export const usePatientsSearch = (): {
  searchResult: SearchResult;
  arePatientsLoading: boolean;
  searchOptions: SearchOptionsState;
  setSearchField: ({ field, value }: { field: keyof SearchOptionsFilters; value: string }) => void;
  resetFilters: () => void;
  search: (params?: PartialSearchOptionsState) => void;
} => {
  const { getAccessTokenSilently } = useAuth0();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchResult, setSearchResult] = useState<SearchResult>(emptySearchResult);
  const [arePatientsLoading, setArePatientsLoading] = useState<boolean>(false);

  const [searchOptions, setSearchOptions] = useState<SearchOptionsState>({
    filters: getFiltersFromUrl(searchParams),
    sort: getSortFromUrl(searchParams),
    pagination: getPaginationFromUrl(searchParams),
  });

  const setSearchField = useCallback(
    ({ field, value }: { field: keyof SearchOptionsFilters; value: string }): void => {
      setSearchOptions((prev) => ({
        ...prev,
        filters: { ...prev.filters, [field]: value },
      }));
    },
    [setSearchOptions]
  );

  const resetFilters = useCallback((): void => {
    setSearchOptions(defaultSearchOptions);
  }, [setSearchOptions]);

  // 1. update state with newSearchOptions
  //      Note: if newSearchOptions is not provided, it will use the current searchOptions state,
  //            if provided - it will merge and update current searchOptions with newSearchOptions.
  // 2. set new search options params to the url
  const search = useCallback(
    (newSearchOptions?: PartialSearchOptionsState): void => {
      const { filters, sort, pagination } = searchOptions;
      const newFilters = { ...filters, ...newSearchOptions?.filters };
      const newSort = { ...sort, ...newSearchOptions?.sort };
      const newPagination = { ...pagination, ...newSearchOptions?.pagination };
      setSearchOptions({ filters: newFilters, sort: newSort, pagination: newPagination });
      const newSearchParams = new URLSearchParams(searchParams);

      Object.entries(newFilters).forEach(([key, value]) => {
        if (value) {
          newSearchParams.set(key, value.toString());
        } else {
          newSearchParams.delete(key);
        }
      });

      Object.entries(newSort).forEach(([key, value]) => {
        if (value) {
          newSearchParams.set(key, value);
        } else {
          newSearchParams.delete(key);
        }
      });

      Object.entries(newPagination).forEach(([key, value]) => {
        if (value) {
          newSearchParams.set(key, value.toString());
        } else {
          newSearchParams.delete(key);
        }
      });

      setSearchParams(newSearchParams);
    },
    [searchOptions, searchParams, setSearchParams]
  );

  // run search on url params change
  useEffect(() => {
    if ([...searchParams.entries()].length > 0) {
      const loadPatients = async (): Promise<void> => {
        setArePatientsLoading(true);
        try {
          const filter: Partial<SearchOptionsFilters> = getFiltersFromUrl(searchParams);
          const sort: SearchOptionsSort = getSortFromUrl(searchParams);
          const pagination: SearchOptionsPagination = getPaginationFromUrl(searchParams);

          let url = buildSearchQuery(filter);
          url = addSearchSort(url, sort);
          url = addSearchPagination(url, pagination);
          url = `${import.meta.env.VITE_APP_FHIR_API_URL}/${url}`;

          await fetchPatients({ searchUrl: url, setSearchResult, setArePatientsLoading, getAccessTokenSilently });
        } catch (error) {
          setSearchResult(emptySearchResult);
          const message = error instanceof Error ? error.message : 'An error occurred while searching';
          enqueueSnackbar(message, { variant: 'error' });
        } finally {
          setArePatientsLoading(false);
        }
      };
      void loadPatients();
    }
  }, [getAccessTokenSilently, searchParams]);

  return {
    searchResult,
    arePatientsLoading,
    searchOptions,
    search,
    setSearchField,
    resetFilters,
  };
};
