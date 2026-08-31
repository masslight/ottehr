import { SearchParam } from '@oystehr/sdk';
import { SearchOptionsPagination } from '../types';

export const addSearchPagination = (pagination: SearchOptionsPagination): SearchParam[] => {
  const params: SearchParam[] = [];

  if (pagination.pageSize) params.push({ name: '_count', value: pagination.pageSize });
  if (pagination.offset) params.push({ name: '_offset', value: pagination.offset });
  params.push({ name: '_total', value: 'accurate' });

  return params;
};
