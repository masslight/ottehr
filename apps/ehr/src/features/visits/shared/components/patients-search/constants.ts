import { SortField, SortOrder } from './types';

export const SEARCH_CONFIG = {
  DEFAULT_PAGE_SIZE: 15,
  ROWS_PER_PAGE_OPTIONS: [5, 15, 30, 50] as const,
  DEFAULT_SORT: {
    field: 'name' as SortField,
    order: 'asc' as SortOrder,
  },
} as const;

export const COLUMN_CONFIG = {
  pid: {
    width: '10%',
  },
  name: {
    width: '15%',
  },
  email: {
    width: '15%',
  },
  dob: {
    width: '10%',
  },
  phone: {
    width: '10%',
  },
  address: {
    width: '20%',
  },
  lastVisit: {
    width: '20%',
  },
} as const;
