import { AppClient, FhirClient, BatchInputRequest } from '@zapehr/sdk';
import { Resource, Practitioner, Location, Appointment, Bundle, FhirResource } from 'fhir/r4';
import { DateTime } from 'luxon';
import { GetTelemedAppointmentsInput, PatientFilterType } from 'ehr-utils';
import { mapTelemedStatusToEncounter, mapStatesToLocationIds } from './mappers';
import { isLocationVirtual, joinLocationsIdsForFhirSearch } from './helpers';
import { LocationIdToAbbreviationMap } from './types';

export const getAllResourcesFromFhir = async (
  fhirClient: FhirClient,
  searchDate: DateTime,
  locationIds: string[],
  encounterStatusesToSearchWith: string[],
): Promise<Resource[]> => {
  const fhirSearchParams = {
    resourceType: 'Appointment',
    searchParams: [
      {
        name: 'date',
        value: `ge${searchDate.startOf('day')}`,
      },
      {
        name: 'date',
        value: `le${searchDate.endOf('day')}`,
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
  if (locationIds.length > 0) {
    fhirSearchParams.searchParams.push({
      name: 'location',
      value: joinLocationsIdsForFhirSearch(locationIds),
    });
  }
  return await fhirClient?.searchResources(fhirSearchParams);
};

export const getPractLicensesLocationsAbbreviations = async (
  fhirClient: FhirClient,
  appClient: AppClient,
): Promise<string[]> => {
  const practitionerId = (await appClient.getMe()).profile.replace('Practitioner/', '');

  const practitioner: Practitioner =
    (await fhirClient.readResource({
      resourceType: 'Practitioner',
      resourceId: practitionerId,
    })) ?? null;
  console.log('Me as practitioner: ' + JSON.stringify(practitioner));

  const allLicensesStates: string[] = [];
  if (practitioner?.qualification) {
    practitioner?.qualification.forEach((qualification: any) => {
      const licenseState = qualification.extension[0].extension[1].valueCodeableConcept.coding[0].code;
      allLicensesStates.push(licenseState);
    });
  }

  return allLicensesStates;
};

export const locationIdsForAppointmentsSearch = async (
  stateFilter: string | undefined,
  patientFilter: PatientFilterType,
  virtualLocationsMap: LocationIdToAbbreviationMap,
  fhirClient: FhirClient,
  appClient: AppClient,
): Promise<string[] | undefined> => {
  let resultStatesAbbreviations: string[] = [];

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

  if (patientFilter === 'my-patients') {
    const practitionerStates = await getPractLicensesLocationsAbbreviations(fhirClient, appClient);
    console.log('Practitioner states: ' + JSON.stringify(practitionerStates));
    if (!stateFilter) {
      resultStatesAbbreviations = practitionerStates;
    } else {
      if (practitionerStates.find((state) => state === stateFilter)) {
        resultStatesAbbreviations = [stateFilter];
      } else {
        return undefined;
      }
    }
  } else {
    if (!stateFilter) {
      resultStatesAbbreviations = [];
    } else {
      resultStatesAbbreviations = [stateFilter];
    }
  }

  return mapStatesToLocationIds(resultStatesAbbreviations, virtualLocationsMap);
};

export const getAllPrefilteredFhirResources = async (
  fhirClient: FhirClient,
  appClient: AppClient,
  params: GetTelemedAppointmentsInput,
  virtualLocationsMap: LocationIdToAbbreviationMap,
): Promise<Resource[] | undefined> => {
  const { dateFilter, stateFilter, statusesFilter, patientFilter } = params;
  let allResources: Resource[] = [];

  const locationsIdsToSearchWith = await locationIdsForAppointmentsSearch(
    stateFilter,
    patientFilter,
    virtualLocationsMap,
    fhirClient,
    appClient,
  );
  if (!locationsIdsToSearchWith) return undefined;
  const encounterStatusesToSearchWith = mapTelemedStatusToEncounter(statusesFilter);
  console.log('Received all location ids and encounter statuses to search with.');

  const dateFilterConverted = DateTime.fromISO(dateFilter);
  allResources = await getAllResourcesFromFhir(
    fhirClient,
    dateFilterConverted,
    locationsIdsToSearchWith,
    encounterStatusesToSearchWith,
  );
  console.log('Received resources from fhir with all filters applied.');
  return allResources;
};

export const getAllVirtualLocationsMap = async (fhirClient: FhirClient): Promise<LocationIdToAbbreviationMap> => {
  // todo: add meta filter to search virtual only
  const resources = await fhirClient.searchResources({
    resourceType: 'Location',
  });

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

export const getOldestAppointmentForEachLocationsGroup = async (
  fhirClient: FhirClient,
  locationsIdsGroups: string[][],
): Promise<Appointment[]> => {
  const requests: BatchInputRequest[] = [];
  // we wanna sort appointments by creation date but in fhir we can only sort by 'start' and 'end' dates
  // so now we have implementation when we create appointment in telemed-intake with start date same as creation date
  // so here we have some kind of 'not stable' code here, and if we've changed appointment 'start' date in intake it not gonna work
  const paramsForAllRequests = ['_has:Encounter:appointment:status=planned', '_sort=date', '_count=1'];

  // also i can't check if appointment virtual in fhir search because we store virtual status as extension
  // and we believe that searching by virtual locations we will get virtual appointments because nobody is using
  // virtual locations but us
  locationsIdsGroups.forEach((locationIdsGroup) => {
    const locationsToSearchWith = joinLocationsIdsForFhirSearch(locationIdsGroup);
    const paramsForCurrentRequest = [`location=${locationsToSearchWith}`];
    const batchRequest: BatchInputRequest = {
      method: 'GET',
      url: '/Appointment?' + paramsForAllRequests.concat(paramsForCurrentRequest).join('&'),
    };
    requests.push(batchRequest);
  });

  const response: Bundle<FhirResource> = await fhirClient.batchRequest({
    requests: requests,
  });

  const parsedAppointments: Appointment[] = [];
  response.entry?.forEach((res) => {
    const bundle = res.resource;
    if (bundle && bundle.resourceType === 'Bundle') {
      const resource = bundle.entry?.[0].resource;
      if (resource && resource.resourceType === 'Appointment') {
        parsedAppointments.push(resource as Appointment);
      }
    }
  });

  return parsedAppointments;
};
