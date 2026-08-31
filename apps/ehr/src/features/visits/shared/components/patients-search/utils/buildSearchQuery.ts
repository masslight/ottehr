import { SearchParam } from '@oystehr/sdk';
import { getFriendlyPatientIdSystem } from 'src/features/visits/shared/utils/friendly-patient-id.helper';
import { SearchOptionsFilters } from '../types';

export const buildSearchQuery = (filter: Partial<SearchOptionsFilters>): SearchParam[] => {
  const params: SearchParam[] = [];

  if (filter.location && filter.location !== 'All') {
    params.push({ name: '_has:Appointment:patient:actor:Location.name:contains', value: filter.location });
  }
  params.push({ name: '_revinclude', value: 'Appointment:patient' });
  params.push({ name: '_include:iterate', value: 'Appointment:actor:Location' });

  if (filter.phone) {
    let completedPhone = filter.phone.replace(/\D/g, '');

    if (!completedPhone.startsWith('+')) {
      if (completedPhone.length === 10) {
        completedPhone = `+1${completedPhone}`;
      } else if (completedPhone.length === 11) {
        completedPhone = `+${completedPhone}`;
      }
    }

    params.push({
      name: 'phone',
      value: completedPhone,
    });
    params.push({ name: '_revinclude', value: 'RelatedPerson:patient' });
    params.push({ name: '_revinclude:iterate', value: 'Person:link' });
  }

  if (filter.lastName) {
    params.push({ name: 'family:contains', value: filter.lastName });
  }
  if (filter.givenNames) {
    const names = filter.givenNames.replace(' ', ',');
    params.push({ name: 'given:contains', value: names });
  }

  if (filter.status === 'Active') params.push({ name: 'active', value: 'true' });
  else if (filter.status === 'Deceased') params.push({ name: 'deceased', value: 'true' });
  else if (filter.status === 'Inactive') params.push({ name: 'active', value: 'false' });

  if (filter.address) {
    params.push({ name: 'address:contains', value: filter.address });
  }

  if (filter.dob) params.push({ name: 'birthdate', value: filter.dob });
  if (filter.email) params.push({ name: 'email', value: filter.email });

  if (filter.pid) {
    const pidValue = filter.pid.trim();
    if (pidValue) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(pidValue)) {
        params.push({ name: '_id', value: pidValue });
      } else {
        const system = getFriendlyPatientIdSystem();
        if (system) {
          params.push({ name: 'identifier', value: `${system}|${pidValue}` });
        }
      }
    }
  }

  return params;
};
