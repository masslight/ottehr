import { BatchInputPostRequest, default as Oystehr } from '@oystehr/sdk';
import { FhirResource, Location, Practitioner, Resource, Schedule } from 'fhir/r4b';
import {
  AllStatesToVirtualLocationsData,
  defaultLocation,
  ELIGIBILITY_PRACTITIONER_META_TAG_PREFIX,
  ELIGIBILITY_PRACTITIONER_TYPES,
  EligibilityPractitionerType,
  FHIR_IDENTIFIER_NPI,
  filterVirtualLocations,
  SCHEDULE_EXTENSION_URL,
  TELEMED_INITIAL_STATES,
  TIMEZONE_EXTENSION_URL,
  unbundleBatchPostOutput,
  VirtualLocationBody
} from 'utils';
import { getAuth0Token } from '../shared';
import { createOystehrClient } from '../shared';
import { randomUUID } from 'crypto';

export const DEFAULT_TESTING_SLUG = 'testing';

const virtualLocations: { value: string; label: string }[] = [
  ...TELEMED_INITIAL_STATES.map((state) => ({ value: state, label: state })),
];

const allPhysicalLocations: { state: string; city: string }[] = [
  {
    state: 'NY',
    city: 'New York',
  },
  {
    state: 'CA',
    city: 'Los Angeles',
  },
];
export type PhysicalLocation = (typeof allPhysicalLocations)[number];

export const checkLocations = async (oystehr: Oystehr): Promise<void> => {
  const allLocations = await oystehr.fhir.search({
    resourceType: 'Location',
  });
  console.log('Received all locations from fhir.');

  const telemedStates: string[] = filterVirtualLocations(allLocations.entry as Resource[]).flatMap((location) => {
    if (location?.address && location.address.state) return [location.address.state];
    return [];
  });

  console.log('Filtered all virtual telemed locations.');

  for (const statePkg of virtualLocations) {
    const stateData = AllStatesToVirtualLocationsData[statePkg.value];
    if (!telemedStates.includes(statePkg.value)) await createTelemedLocation(statePkg, stateData, oystehr);
  }
  console.log('All telemed locations exist');

  for (const locationInfo of allPhysicalLocations) {
    await createPhysicalLocation(locationInfo, oystehr);
  }
};

const TELEMED_VIRTUAL_LOCATION_CODE_SYSTEM = 'https://fhir.pmpediatriccare.com/r4/location-code';

const createTelemedLocation = async (
  state: { value: string; label: string },
  stateData: VirtualLocationBody,
  oystehr: Oystehr
): Promise<void> => {
  const location: Location = {
    resourceType: 'Location',
    status: 'active',
    address: {
      state: state.value,
    },
    extension: [
      {
        url: 'https://extensions.fhir.zapehr.com/location-form-pre-release',
        valueCoding: {
          system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
          code: 'vi',
          display: 'Virtual',
        },
      },
    ],
    identifier: [
      {
        system: 'https://fhir.ottehr.com/r4/slug',
        value: stateData.name.replace(/\s/g, ''), // remove whitespace from the name
      },
    ],
    // managing organization will be added later after organizations are created
    type: stateData.code
      ? [
          {
            coding: [
              {
                system: TELEMED_VIRTUAL_LOCATION_CODE_SYSTEM,
                code: stateData.code,
              },
            ],
          },
        ]
      : undefined,
    name: stateData.name,
  };
  const createLocationRequest: BatchInputPostRequest<Location> = {
    method: 'POST',
    url: '/Location',
    resource: location,
    fullUrl: `urn:uuid:${randomUUID()}`,
  }

  /*
    for each location, we create a schedule with a json extension that will be used in calculating the available bookable
    slots for that location at any moment in time.
  */
  const locationSchedule: Schedule = {
    resourceType: 'Schedule',
    active: true,
    extension: [
      {
        url: SCHEDULE_EXTENSION_URL,
        valueString:
          '{"schedule":{"monday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"tuesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"wednesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"thursday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"friday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"saturday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"sunday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]}},"scheduleOverrides":{}}',
      },
      {
        url: TIMEZONE_EXTENSION_URL,
        valueString: 'America/New_York',
      },
    ],
    actor: [{
      reference: createLocationRequest.fullUrl,
    }],
  };

  const createScheduleRequest: BatchInputPostRequest<Schedule> = {
    method: 'POST',
    url: '/Schedule',
    resource: locationSchedule,
  };

  const fhirResponse = await oystehr.fhir.transaction<Location | Schedule>({ requests: [createLocationRequest, createScheduleRequest] });
  const unbundled = unbundleBatchPostOutput<Location|Schedule>(fhirResponse);
  const fhirLocation = unbundled.find((resource) => resource.resourceType === 'Location') as Location;
  console.log(`Created fhir location: state: ${fhirLocation?.address?.state}, id: ${fhirLocation?.id}`);
  console.log(`Created fhir schedule: id: ${locationSchedule.id} for ${fhirLocation?.address?.state} location`);
};

const createPhysicalLocation = async (
  locationInfo: PhysicalLocation,
  oystehr: Oystehr
): Promise<FhirResource | null> => {
  const prevLocations = await oystehr.fhir.search({
    resourceType: 'Location',
    params: [
      {
        name: 'name',
        value: `${locationInfo.city}, ${locationInfo.state}`,
      },
    ],
  });

  if (!prevLocations.entry?.length) {
    const newLocation = defaultLocation;
    newLocation.name = `${locationInfo.city}, ${locationInfo.state}`;
    newLocation.address = {
      city: locationInfo.city,
      state: locationInfo.state,
    };
    // add identifiers
    newLocation.identifier = [
      {
        system: 'https://fhir.ottehr.com/r4/slug',
        value: `${locationInfo.city}-${locationInfo.state}`.replace(/\s/g, ''), // remove whitespace from the name
      },
    ];

    // todo: remove once the walkin in-person flow is not dependant on having a slug of 'testing'
    if (locationInfo.city == 'New York' && locationInfo.state == 'NY') {
      newLocation.identifier = [
        {
          system: 'https://fhir.ottehr.com/r4/slug',
          value: DEFAULT_TESTING_SLUG,
        },
      ];
    }

    const createLocationRequest: BatchInputPostRequest<Location> = {
      method: 'POST',
      url: '/Location',
      resource: newLocation,
      fullUrl: `urn:uuid:${randomUUID()}`,
    };

    /*
      for each location, we create a schedule with a json extension that will be used in calculating the available bookable
      slots for that location at any moment in time.
    */
    const locationSchedule: Schedule = {
      resourceType: 'Schedule',
      active: true,
      extension: [
        {
          url: SCHEDULE_EXTENSION_URL,
          valueString:
            '{"schedule":{"monday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":10},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]},"tuesday":{"open":8,"close":21,"openingBuffer":0,"closingBuffer":30,"workingDay":true,"hours":[{"hour":8,"capacity":10},{"hour":9,"capacity":5},{"hour":10,"capacity":7},{"hour":11,"capacity":4},{"hour":12,"capacity":8},{"hour":13,"capacity":11},{"hour":14,"capacity":1},{"hour":15,"capacity":2},{"hour":16,"capacity":1},{"hour":17,"capacity":1},{"hour":18,"capacity":2},{"hour":19,"capacity":2},{"hour":20,"capacity":6}]},"wednesday":{"open":8,"close":0,"openingBuffer":30,"closingBuffer":30,"workingDay":true,"hours":[{"hour":8,"capacity":20},{"hour":9,"capacity":20},{"hour":10,"capacity":20},{"hour":11,"capacity":20},{"hour":12,"capacity":20},{"hour":13,"capacity":20},{"hour":14,"capacity":20},{"hour":15,"capacity":20},{"hour":16,"capacity":20},{"hour":17,"capacity":20},{"hour":18,"capacity":20},{"hour":19,"capacity":20},{"hour":20,"capacity":20},{"hour":21,"capacity":20},{"hour":22,"capacity":20},{"hour":23,"capacity":20}]},"thursday":{"open":18,"close":24,"openingBuffer":30,"closingBuffer":0,"workingDay":true,"hours":[{"hour":0,"capacity":0},{"hour":1,"capacity":0},{"hour":2,"capacity":0},{"hour":3,"capacity":0},{"hour":4,"capacity":0},{"hour":5,"capacity":0},{"hour":6,"capacity":0},{"hour":7,"capacity":0},{"hour":8,"capacity":0},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":12},{"hour":18,"capacity":10},{"hour":19,"capacity":10},{"hour":20,"capacity":10},{"hour":21,"capacity":0},{"hour":22,"capacity":10},{"hour":23,"capacity":10}]},"friday":{"open":14,"close":21,"openingBuffer":30,"closingBuffer":30,"workingDay":true,"hours":[{"hour":14,"capacity":5},{"hour":15,"capacity":6},{"hour":16,"capacity":6},{"hour":17,"capacity":5},{"hour":18,"capacity":5},{"hour":19,"capacity":5},{"hour":20,"capacity":5}]},"saturday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]},"sunday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]}},"scheduleOverrides":{"12/21/2023":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"12/9/2023":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"05/01/2024":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"1/19/2024":{"open":7,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]}}}',
        },
        {
          url: TIMEZONE_EXTENSION_URL,
          valueString: 'America/New_York',
        },
      ],
      actor: [{
        reference: createLocationRequest.fullUrl,
      }],
    };

    const createScheduleRequest: BatchInputPostRequest<Schedule> = {
      method: 'POST',
      url: '/Schedule',
      resource: locationSchedule,
    };

    return await oystehr.fhir.transaction<Location | Schedule>({
      requests: [createLocationRequest, createScheduleRequest],
    });
  } else {
    console.log(`Location already exists.`);
    return null;
  }
};

// Create Practitioners
const createPractitionerForEligibilityCheck = async (config: any): Promise<void> => {
  const envToken = await getAuth0Token(config);
  const oystehr = createOystehrClient(envToken, config);

  ELIGIBILITY_PRACTITIONER_TYPES.forEach(async (type) => {
    const eligibilityPractitioners = (
      await oystehr.fhir.search<Practitioner>({
        resourceType: 'Practitioner',
        params: [
          {
            name: '_tag',
            value: `${ELIGIBILITY_PRACTITIONER_META_TAG_PREFIX}_${type}`,
          },
        ],
      })
    ).unbundle();

    if (eligibilityPractitioners.length === 0) await createNewPractitioner(config, oystehr, type);
  });
};

const createNewPractitioner = async (
  config: any,
  oystehr: Oystehr,
  type: EligibilityPractitionerType
): Promise<void> => {
  // Dummy lowers NPI for Claim MD's sandbox environment.
  let npi = '1790914042';
  if (config.ENVIRONMENT === 'production') {
    npi = type === 'individual' ? '1326138728' : '1275013955';
  }
  const practitioner: Practitioner = {
    resourceType: 'Practitioner',
    identifier: [
      {
        system: FHIR_IDENTIFIER_NPI,
        type: {
          coding: [
            {
              code: 'NPI',
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            },
          ],
        },
        value: npi,
      },
    ],
    meta: {
      tag: [
        {
          code: `${ELIGIBILITY_PRACTITIONER_META_TAG_PREFIX}_${type}`,
        },
      ],
    },
  };
  await oystehr.fhir.create(practitioner);
  console.log(`Created eligibility MVP ${type} practitioner`);
};

// Main

const main = async (): Promise<void> => {
  try {
    await Promise.all([checkLocations, createPractitionerForEligibilityCheck]);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
