import { SearchOptionsPagination } from '../types';

export const addSearchPagination = (url: string, pagination: SearchOptionsPagination): string => {
  const params: string[] = [];

  if (pagination.pageSize) params.push(`_count=${pagination.pageSize}`);
  if (pagination.offset) params.push(`_offset=${pagination.offset}`);
  params.push('_total=accurate');

  return `${url}${url.includes('?') ? '&' : '?'}${params.join('&')}`;
};
