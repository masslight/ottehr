import Oystehr from '@oystehr/sdk';
import { FhirResource, Location, Practitioner, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  GetTelemedAppointmentsInput,
  OTTEHR_MODULE,
  PatientFilterType,
  allLicensesForPractitioner,
  isLocationVirtual,
} from 'utils';
import { joinLocationsIdsForFhirSearch } from './helpers';
import { mapStatesToLocationIds, mapTelemedStatusToEncounterAndAppointment } from './mappers';
import { LocationIdToAbbreviationMap } from './types';

export const getAllResourcesFromFhir = async (
  oystehr: Oystehr,
  locationIds: string[],
  encounterStatusesToSearchWith: string[],
  appointmentStatusesToSearchWith: string[],
  searchDate?: DateTime
): Promise<FhirResource[]> => {
  const fhirSearchParams = {
    //
    resourceType: 'Appointment',
    params: [
      {
        name: '_tag',
        value: OTTEHR_MODULE.TM,
      },
      {
        name: 'status',
        value: appointmentStatusesToSearchWith.join(','),
      },
      {
        name: '_has:Encounter:appointment:status',
        value: encounterStatusesToSearchWith.join(','),
      },
      {
        name: '_sort',
        value: 'date',
      },
      { name: '_count', value: '1000' },
      {
        name: '_include',
        value: 'Appointment:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'RelatedPerson:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Encounter:participant',
      },
      {
        name: '_include:iterate',
        value: 'Encounter:participant:Practitioner',
      },
      {
        name: '_include',
        value: 'Appointment:location',
      },
      {
        name: '_revinclude:iterate',
        value: 'Encounter:appointment',
      },
      {
        name: '_revinclude:iterate',
        value: 'DocumentReference:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'QuestionnaireResponse:encounter',
      },
    ],
  };

  console.log(22222221, fhirSearchParams);

  if (searchDate) {
    fhirSearchParams.params.push(
      {
        name: 'date',
        value: `ge${searchDate.startOf('day')}`,
      },
      {
        name: 'date',
        value: `le${searchDate.endOf('day')}`,
      }
    );
  }
  if (locationIds.length > 0) {
    fhirSearchParams.params.push({
      name: 'location',
      value: joinLocationsIdsForFhirSearch(locationIds),
    });
  }
  return (await oystehr.fhir.search<FhirResource>(fhirSearchParams)).unbundle();
};

export const getPractLicensesLocationsAbbreviations = async (oystehr: Oystehr): Promise<string[]> => {
  const practitionerId = (await oystehr.user.me()).profile.replace('Practitioner/', '');

  const practitioner: Practitioner =
    (await oystehr.fhir.get({
      resourceType: 'Practitioner',
      id: practitionerId,
    })) ?? null;
  console.log('Me as practitioner: ' + JSON.stringify(practitioner));

  return allLicensesForPractitioner(practitioner).map((license) => license.state);
};

const locationIdsForAppointmentsSearch = async (
  usStatesFilter: string[] | undefined,
  patientFilter: PatientFilterType,
  virtualLocationsMap: LocationIdToAbbreviationMap,
  oystehr: Oystehr
): Promise<string[] | undefined> => {
  // Little explanation what patientFilter = 'my-patients' means:
  // It means that practitioner wanna see appointments with locations that match
  // with his licenses registration locations.

  // We have 5 possible 'patientFilter' and 'stateFilter' combinations:
  // 1. patientFilter = 'my-patients' and stateFilter = undefined
  //      In this case we want to find all appointments with all locations that
  //      practitioner has in his licenses

  // 2. patientFilter = 'my-patients' and stateFilter = /match with one of practitioner licenses locations/
  //      In this case we want to return all appointments with 'stateFilter'

  // 3. patientFilter = 'my-patients' and stateFilter = /practitioner doesn't have stateFilter in his licenses locations/
  //      In this case we want to return empty array because locations don't match

  // 4. patientFilter = 'all-patients' and stateFilter = undefined
  //      In this case we want to return all appointments with all locations possible

  // 5. patientFilter = 'all-patients' and stateFilter = /exists/
  //      In this case we want to return appointments with location == stateFilter

  const intersect = (arr1: string[], arr2: string[]): string[] => {
    const buffer = new Set(arr2);
    return arr1.filter((element) => buffer.has(element));
  };

  const usStatesFilterOrEmpty = usStatesFilter || [];
  const hasNoUsStatesFiltersSet = usStatesFilterOrEmpty.length === 0;

  console.log('Requested US_states filter: ' + JSON.stringify(usStatesFilter));

  if (patientFilter !== 'my-patients') {
    const statesAbbreviations = hasNoUsStatesFiltersSet ? [] : [...usStatesFilterOrEmpty];
    return mapStatesToLocationIds(statesAbbreviations, virtualLocationsMap);
  }

  if (patientFilter === 'my-patients') {
    const licensedPractitionerStates = await getPractLicensesLocationsAbbreviations(oystehr);
    console.log('Licensed Practitioner US_states: ' + JSON.stringify(licensedPractitionerStates));

    if (hasNoUsStatesFiltersSet) {
      return mapStatesToLocationIds(licensedPractitionerStates, virtualLocationsMap);
    }

    const allowedUsStates = intersect(licensedPractitionerStates, usStatesFilterOrEmpty);
    console.log('Licensed Practitioner US_states + Applied US_states filter: ' + JSON.stringify(allowedUsStates));

    if (allowedUsStates.length === 0) {
      return undefined;
    }

    return mapStatesToLocationIds(allowedUsStates, virtualLocationsMap);
  }

  return mapStatesToLocationIds([], virtualLocationsMap);
};

export const getAllPrefilteredFhirResources = async (
  oystehrm2m: Oystehr,
  oystehrCurrentUser: Oystehr,
  params: GetTelemedAppointmentsInput,
  virtualLocationsMap: LocationIdToAbbreviationMap
): Promise<Resource[] | undefined> => {
  const { dateFilter, usStatesFilter, statusesFilter, patientFilter } = params;
  let allResources: Resource[] = [];

  const locationsIdsToSearchWith = await locationIdsForAppointmentsSearch(
    usStatesFilter,
    patientFilter,
    virtualLocationsMap,
    oystehrCurrentUser
  );
  if (!locationsIdsToSearchWith) return undefined;
  const { encounterStatuses: encounterStatusesToSearchWith, appointmentStatuses: appointmentStatusesToSearchWith } =
    mapTelemedStatusToEncounterAndAppointment(statusesFilter);
  console.log('Received all location ids and encounter statuses to search with.');
  if (locationsIdsToSearchWith.length === 0 && patientFilter === 'my-patients') {
    return [];
  }

  const dateFilterConverted = dateFilter ? DateTime.fromISO(dateFilter) : undefined;
  allResources = await getAllResourcesFromFhir(
    oystehrm2m,
    locationsIdsToSearchWith,
    encounterStatusesToSearchWith,
    appointmentStatusesToSearchWith,
    dateFilterConverted
  );
  console.log('Received resources from fhir with all filters applied.');
  return allResources;
};

export const getAllVirtualLocationsMap = async (oystehr: Oystehr): Promise<LocationIdToAbbreviationMap> => {
  // todo: add meta filter to search virtual only
  const resources = (
    await oystehr.fhir.search({
      resourceType: 'Location',
    })
  ).unbundle();

  const virtualLocationsMap: LocationIdToAbbreviationMap = {};
  const locations: Location[] = [];

  resources.forEach((resource) => {
    if (resource.resourceType === 'Location' && isLocationVirtual(resource as Location)) {
      const location = resource as Location;
      const state = location.address?.state;
      const locationId = location.id;

      if (state && locationId) {
        virtualLocationsMap[state] = locationId;
        locations.push(location);
      }
    }
  });

  return virtualLocationsMap;
};
