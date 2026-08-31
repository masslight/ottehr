import { SearchParam } from '@oystehr/sdk';
import { SearchOptionsSort } from '../types';

export const addSearchSort = (options: SearchOptionsSort): SearchParam[] => {
  const params: SearchParam[] = [];

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

  params.push({ name: '_sort', value: `${sortField},_id` });

  return params;
};
