import { SearchOptionsFilters } from '../types';

export const buildSearchQuery = (filter: Partial<SearchOptionsFilters>): string => {
  const baseUrl = 'r4/Patient';
  const params: string[] = [];

  if (filter.location && filter.location !== 'All') {
    params.push(`_has:Appointment:patient:actor:Location.name:contains=${encodeURIComponent(filter.location)}`);
  }
  params.push('_revinclude=Appointment:patient');
  params.push('_include:iterate=Appointment:actor:Location');

  if (filter.phone) {
    const digits = filter.phone.replace(/\D/g, '');
    params.push(
      `phone:contains=${digits},_has:RelatedPerson:patient:phone:contains=${digits},_has:RelatedPerson:patient:_has:Person:link:phone:contains=${digits}`
    );
    params.push('_revinclude=RelatedPerson:patient');
    params.push('_revinclude:iterate=Person:link');
  }

  if (filter.lastName) {
    params.push(`family:contains=${encodeURIComponent(filter.lastName)}`);
  }
  if (filter.givenNames) {
    const names = filter.givenNames.replace(' ', ',');
    params.push(`given:contains=${encodeURIComponent(names)}`);
  }

  if (filter.status === 'Active') params.push('active=true');
  else if (filter.status === 'Deceased') params.push('deceased=true');
  else if (filter.status === 'Inactive') params.push('active=false');

  if (filter.address) {
    params.push(`address:contains=${encodeURIComponent(filter.address)}`);
  }

  if (filter.dob) params.push(`birthdate=${encodeURIComponent(filter.dob)}`);
  if (filter.email) params.push(`email:contains=${encodeURIComponent(filter.email)}`);

  params.push('_total=accurate');

  return `${baseUrl}?${params.join('&')}`;
};
