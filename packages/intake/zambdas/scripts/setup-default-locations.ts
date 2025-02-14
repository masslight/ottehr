import { default as Oystehr } from '@oystehr/sdk';
import { FhirResource, Location, Practitioner, Resource } from 'fhir/r4b';
import {
  AllStatesToVirtualLocationsData,
  defaultLocation,
  ELIGIBILITY_PRACTITIONER_META_TAG_PREFIX,
  ELIGIBILITY_PRACTITIONER_TYPES,
  EligibilityPractitionerType,
  FHIR_IDENTIFIER_NPI,
  filterVirtualLocations,
  TIMEZONE_EXTENSION_URL,
  VirtualLocationBody,
} from 'utils';
import { getAuth0Token } from '../src/shared';
import { createOystehrClient } from '../src/shared/helpers';

const virtualLocations: { value: string; label: string }[] = [
  { value: 'NJ', label: 'NJ' },
  { value: 'OH', label: 'OH' },
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

  const telemedStates: string[] = [];
  filterVirtualLocations(allLocations.entry as Resource[]).map((location) => {
    if (location?.address && location.address.state) telemedStates.push(location.address.state);
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
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
        valueString:
          '{"schedule":{"monday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"tuesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"wednesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"thursday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"friday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"saturday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"sunday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]}},"scheduleOverrides":{}}',
      },
      {
        url: TIMEZONE_EXTENSION_URL,
        valueString: 'America/New_York',
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
  const fhirResponse = await oystehr.fhir.create(location);
  console.log(`Created fhir location: state: ${fhirResponse.address?.state}, id: ${fhirResponse.id}`);
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
          value: `testing`,
        },
      ];
    }

    return await oystehr.fhir.create(newLocation as FhirResource);
  } else {
    console.log(`Location already exists.`);
    return null;
  }
};

// Create Practitioners
const createPractitionerForEligibilityCheck = async (config: any): Promise<void> => {
  const envToken = await getAuth0Token(config);
  const oystehr = await createOystehrClient(envToken, config);

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
