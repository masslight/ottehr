import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Location, Practitioner } from 'fhir/r4b';
import {
  addEmptyArrOperation,
  addOperation,
  addOrReplaceOperation,
  AllStates,
  AllStatesToVirtualLocationsData,
  ELIGIBILITY_PRACTITIONER_META_TAG_PREFIX,
  ELIGIBILITY_PRACTITIONER_TYPES,
  EligibilityPractitionerType,
  FHIR_IDENTIFIER_NPI,
  filterVirtualLocations,
  getPatchBinary,
  getResourcesFromBatchInlineRequests,
  removeOperation,
  replaceOperation,
  VirtualLocationBody,
} from 'utils';
import { performEffectWithEnvFile } from 'zambda-utils';
import { createOystehrClientFromConfig } from './helpers';
// Create Locations

const checkTelemedVirtualLocations = async (config: any): Promise<void> => {
  const oystehr = await createOystehrClientFromConfig(config);

  const allResources = await getResourcesFromBatchInlineRequests(oystehr, ['Organization', 'Location']);
  console.log('Received all locations from fhir.');

  const existVirtualLocationsStates: string[] = [];
  filterVirtualLocations(allResources).forEach((location) => {
    if (location?.address && location.address.state) {
      console.log(`Found existed location. state: ${location.address.state}, id: ${location.id}`);
      existVirtualLocationsStates.push(location.address.state);
    }
  });

  for (const statePkg of AllStates) {
    if (!existVirtualLocationsStates.includes(statePkg.value)) {
      const stateData = AllStatesToVirtualLocationsData[statePkg.value];
      await createTelemedLocation(statePkg, stateData, oystehr);
    }
  }
  await checkAndAddDataToLocations(oystehr);
  console.log('All locations exists.');
};

const TELEMED_VIRTUAL_LOCATION_CODE_SYSTEM = 'https://fhir.ottehr.com/r4/location-code';

async function checkAndAddDataToLocations(oystehr: Oystehr): Promise<void> {
  try {
    const allResources = await getResourcesFromBatchInlineRequests(oystehr, ['Organization', 'Location']);
    const virtualLocations = filterVirtualLocations(allResources);
    for (const location of virtualLocations) {
      const locationOperations: Operation[] = [];
      const state = location.address?.state;
      if (state) {
        const locationData = AllStatesToVirtualLocationsData[state];
        let currentLocationCode: string | undefined,
          typeIndex = 0,
          codingIndex = 0;

        // checking location code
        location.type?.find(
          (type, typeIdx) =>
            type.coding?.find((coding, codingIdx) => {
              if (coding.system === TELEMED_VIRTUAL_LOCATION_CODE_SYSTEM && coding.code) {
                currentLocationCode = coding.code;
                typeIndex = typeIdx;
                codingIndex = codingIdx;
              }
            })
        );
        if (locationData.code && currentLocationCode === undefined) {
          if (!location.type) locationOperations.push(addEmptyArrOperation('/type'));
          locationOperations.push(
            addOperation('/type/-', {
              coding: [
                {
                  system: TELEMED_VIRTUAL_LOCATION_CODE_SYSTEM,
                  code: locationData.code,
                },
              ],
            })
          );
        } else if (currentLocationCode && locationData.code === undefined) {
          locationOperations.push(removeOperation(`/type/${typeIndex}`));
        } else if (locationData.code !== currentLocationCode) {
          locationOperations.push(replaceOperation(`/type/${typeIndex}/coding/${codingIndex}/code`, locationData.code));
        }

        // we don't use Locations for facility groups anymore so removing partOf
        if (location.partOf) locationOperations.push(removeOperation('/partOf'));

        // checking location name
        const currentLocationName = location.name;
        if (currentLocationName !== locationData.name) {
          locationOperations.push(addOrReplaceOperation(currentLocationName, '/name', locationData.name));
        }
      }
      if (location.id && locationOperations.length > 0) {
        console.log(`location id: ${location.id}, operations: `, JSON.stringify(locationOperations));
        await oystehr.fhir.transaction({
          requests: [
            getPatchBinary({
              resourceId: location.id,
              resourceType: 'Location',
              patchOperations: locationOperations,
            }),
          ],
        });
      }
    }

    console.log('Received all locations from fhir after creating new ones.');
  } catch (e) {
    console.log('Error updating locations information: ', e, JSON.stringify(e));
  }
}

const createTelemedLocation = async (
  state: { value: string; label: string },
  stateData: VirtualLocationBody,
  oystehr: Oystehr
): Promise<void> => {
  const location: Location = {
    resourceType: 'Location',
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

const createPractitionerForEligibilityCheck = async (config: any): Promise<void> => {
  const oystehr = await createOystehrClientFromConfig(config);

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
    await Promise.all([
      performEffectWithEnvFile('ehr', checkTelemedVirtualLocations),
      performEffectWithEnvFile('ehr', createPractitionerForEligibilityCheck),
    ]);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
