import { SearchOptionsSort } from '../types';

export const addSearchSort = (url: string, options: SearchOptionsSort): string => {
  const params: string[] = [];

  let sortField = '';
  switch (options.field) {
    case 'name':
      sortField = 'family,given';
      break;
    case 'dob':
      sortField = 'birthdate';
      break;
    default:
      sortField = 'family,given';
  }

  if (options.order === 'desc') sortField = '-' + sortField;

  params.push(`_sort=${sortField},_id`);

  return `${url}${url.includes('?') ? '&' : '?'}${params.join('&')}`;
};
