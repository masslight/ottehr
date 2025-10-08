export type SortField = 'name' | 'dob';
export type SortOrder = 'asc' | 'desc';

export interface SearchOptionsState {
  filters: SearchOptionsFilters;
  sort: SearchOptionsSort;
  pagination: SearchOptionsPagination;
}

export interface PartialSearchOptionsState {
  filters?: Partial<SearchOptionsFilters>;
  sort?: Partial<SearchOptionsSort>;
  pagination?: Partial<SearchOptionsPagination>;
}

export interface SearchOptionsFilters {
  givenNames: string;
  lastName: string;
  dob: string;
  pid: string;
  phone: string;
  address: string;
  email: string;
  // subscriberNumber: string;
  status: 'All' | 'Active' | 'Deceased' | 'Inactive';
  location: string;
}

export interface SearchOptionsSort {
  field: SortField;
  order: SortOrder;
}

export interface SearchOptionsPagination {
  pageSize: number;
  offset: number;
}

export interface SearchResult {
  patients: SearchResultParsedPatient[];
  pagination: SearchResultPaginationInfo;
}

export interface SearchResultPaginationInfo {
  next: string | null;
  prev: string | null;
  totalItems: number;
}

export interface SearchResultParsedPatient {
  id: string;
  pid?: string;
  name: string;
  birthDate?: string;
  phone?: string;
  email?: string;
  address?: {
    city: string;
    zip: string;
    state: string;
    line: string;
  };
  lastVisit?: {
    date: string;
    location: string;
  };
}
