import { SearchParam } from '@zapehr/sdk';
import { OTTEHR_MODULE } from 'ehr-utils';

export const MAX_RESULTS = 20;

export const getPatientNameSearchParams = (input: {
  firstLast?: { first: string | undefined; last: string | undefined };
  submittedName?: string | undefined;
  narrowByRelatedPersonAndAppointment?: boolean;
  maxResultOverride?: number;
}): SearchParam[] => {
  const {
    submittedName,
    firstLast,
    narrowByRelatedPersonAndAppointment = true,
    maxResultOverride: maxResults = MAX_RESULTS,
  } = input;
  const hasParams = narrowByRelatedPersonAndAppointment
    ? [
        //{ name: '_has:RelatedPerson:patient:relationship', value: 'user-relatedperson' }, // RelatedPerson referenced by the Person resource
        { name: '_has:Appointment:patient:_tag', value: [OTTEHR_MODULE.UC, OTTEHR_MODULE.TM].join(',') },
      ]
    : [];
  const fhirSearchParams: SearchParam[] = [
    ...hasParams,
    { name: '_count', value: maxResults.toString() },
    { name: '_total', value: 'accurate' },
    {
      name: '_sort',
      value: 'family',
    },
    { name: '_elements', value: 'id,name,birthDate' },
  ];

  if (submittedName) {
    const [lastName, firstName] = (submittedName?.toLowerCase() ?? '').split(',');
    if (lastName && firstName) {
      fhirSearchParams.push({ name: 'family', value: lastName.trim() }, { name: 'given', value: firstName.trim() });
    } else {
      fhirSearchParams.push({ name: 'name', value: submittedName.replace(/\W/g, '') });
    }
  } else if (firstLast) {
    const { first: firstName, last: lastName } = firstLast;
    if (lastName && firstName) {
      fhirSearchParams.push({ name: 'family', value: lastName.trim() }, { name: 'given', value: firstName.trim() });
    }
  }
  return fhirSearchParams;
};
