import { Appointment, Bundle, BundleEntry, Location } from 'fhir/r4b';
import { SearchResultPaginationInfo, SearchResultParsedPatient } from '../types';
import { SearchResult } from '../types';

export const parseSearchResults = (fhirResponse: Bundle): SearchResult => {
  const patients: SearchResultParsedPatient[] = [];

  if (!fhirResponse.entry)
    return {
      patients,
      pagination: { next: null, prev: null, totalItems: 0 },
    };

  const locationMap = new Map(
    fhirResponse.entry
      .filter((e) => e.resource?.resourceType === 'Location')
      .map((e) => [e?.resource?.id, (e?.resource as Location)?.name])
  );

  for (const entry of fhirResponse.entry) {
    if (entry.resource?.resourceType !== 'Patient') continue;

    const patient = entry.resource;

    const appointments = (fhirResponse.entry as BundleEntry<Appointment>[])
      .filter(
        (e) =>
          e.resource?.resourceType === 'Appointment' &&
          e.resource.participant?.some((p) => p.actor?.reference === `Patient/${patient.id}`)
      )
      .map((e) => e.resource)
      .filter(Boolean);

    (appointments as Appointment[]).sort(
      (a, b) => new Date(b?.start as string).getTime() - new Date(a?.start as string).getTime()
    );

    const lastAppointment = appointments[0];

    let lastVisit: SearchResultParsedPatient['lastVisit'] | undefined;

    if (lastAppointment) {
      const locationRef = lastAppointment.participant?.find((p) => p.actor?.reference?.startsWith('Location/'))?.actor
        ?.reference;

      const locationId = locationRef?.split('/')[1];

      lastVisit = {
        date: lastAppointment.start as string,
        location: locationMap.get(locationId) || '',
      };
    }

    const lastName = patient.name?.[0]?.family;

    const parsedPatient: SearchResultParsedPatient = {
      id: patient.id as string,
      name: `${lastName || ''}, ${patient.name?.[0]?.given?.join(' ') || ''}`,
      birthDate: patient.birthDate,
      phone: patient.telecom?.find((t) => t.system === 'phone')?.value,
      email: patient.telecom?.find((t) => t.system === 'email')?.value,
      address: patient.address?.[0]
        ? {
            city: patient.address[0].city || '',
            zip: patient.address[0].postalCode || '',
            state: patient.address[0].state || '',
            line: patient.address[0].line?.join(', ') || '',
          }
        : undefined,
      lastVisit,
      lastName,
      firstName: patient.name?.[0]?.given?.join(' '),
      middleName: patient.name?.[0].given?.[1],
      sex: patient.gender,
    };

    patients.push(parsedPatient);
  }

  const pagination: SearchResultPaginationInfo = {
    next: null,
    prev: null,
    totalItems: fhirResponse.total || 0,
  };

  if (fhirResponse.link) {
    const nextLink = fhirResponse.link.find((link) => link.relation === 'next');
    const previousLink = fhirResponse.link.find((link) => link.relation === 'previous');

    pagination.next = nextLink?.url || null;
    pagination.prev = previousLink?.url || null;
  }

  return {
    patients,
    pagination,
  };
};
