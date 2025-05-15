import { BatchInputRequest } from '@oystehr/sdk';
import {
  ActivityDefinition,
  ObservationDefinition,
  Reference,
  ValueSet,
  ObservationDefinitionQuantitativeDetails,
  ObservationDefinitionQualifiedInterval,
} from 'fhir/r4b';
import {
  testItems,
  TestItem,
  UrinalysisComponent,
  QuantityTestItem,
  IN_HOUSE_TEST_CODE_SYSTEM,
  IN_HOUSE_PARTICIPANT_ROLE_SYSTEM,
  IN_HOUSE_TAG_DEFINITION,
  IN_HOUSE_UNIT_OF_MEASURE_SYSTEM,
  IN_HOUSE_RESULTS_VALUESET_SYSTEM,
} from 'utils';
import fs from 'fs';
import { getAuth0Token, createOystehrClient } from '../shared';

const VALID_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo'];
const USAGE_STR = `Usage: npm run make-in-house-test-items [${VALID_ENVS.join(' | ')}]\n`;

const checkEnvPassedIsValid = (env: string | undefined): boolean => {
  if (!env) return false;
  return VALID_ENVS.includes(env);
};

const sanitizeForId = (str: string): string => {
  /* eslint-disable-next-line  no-useless-escape */
  return str.replace(/[ ()\/\\]/g, '');
};

const makeValueSet = (
  itemName: string,
  values: string[],
  isAbnormal: boolean
): { valueSetId: string; valueSet: ValueSet } => {
  const valueSetId = `contained-${sanitizeForId(itemName)}-${isAbnormal ? 'abnormal' : 'normal'}-valueSet`;

  const valueSet: ValueSet = {
    id: valueSetId,
    resourceType: 'ValueSet',
    status: 'active',
    compose: {
      include: [
        {
          system: IN_HOUSE_RESULTS_VALUESET_SYSTEM,
          concept: values.map((valueStr) => {
            return {
              code: valueStr,
            };
          }),
        },
      ],
    },
  };

  return {
    valueSetId,
    valueSet,
  };
};

const makeQuantitativeDetails = (
  item: QuantityTestItem | UrinalysisComponent
): ObservationDefinitionQuantitativeDetails => {
  if (!item.normalRange) {
    throw new Error(`Cannot make quantitativeDetails for ${JSON.stringify(item)}`);
  }
  return {
    decimalPrecision: item.normalRange.precision,
    unit: item.normalRange.unit
      ? {
          coding: [
            {
              system: IN_HOUSE_UNIT_OF_MEASURE_SYSTEM,
              code: item.normalRange.unit,
            },
          ],
        }
      : undefined,
  };
};

const makeQualifiedInterval = (
  item: QuantityTestItem | UrinalysisComponent
): ObservationDefinitionQualifiedInterval => {
  if (!item.normalRange) {
    throw new Error(`Cannot make QualifiedInterval for ${JSON.stringify(item)}`);
  }
  return {
    category: 'reference',
    range: {
      low: item.normalRange.low !== undefined ? { value: item.normalRange.low } : undefined,
      high: item.normalRange.high !== undefined ? { value: item.normalRange.high } : undefined,
    },
  };
};

const getQuantityObservationDefinition = (
  item: TestItem
): { obsDef: ObservationDefinition; contained: ObservationDefinition[] } => {
  if (item.dataType !== 'Quantity') {
    throw new Error('Cannot get quantity obs def from non-quantity test item');
  }

  const obsDef: ObservationDefinition = {
    id: `contained-${sanitizeForId(item.name)}-quantity-observationDef-id`,
    resourceType: 'ObservationDefinition',
    code: {
      coding: [
        ...item.loincCode.map((loincCode) => {
          return { system: 'http://loinc.org', code: loincCode };
        }),
      ],
      text: item.name,
    },
    permittedDataType: [item.dataType],
    quantitativeDetails: makeQuantitativeDetails(item),
    qualifiedInterval: [makeQualifiedInterval(item)],
  };

  return {
    obsDef,
    contained: [obsDef],
  };
};

const getCodeableConceptObservationDefinition = (
  item: TestItem
): { obsDef: ObservationDefinition; contained: (ValueSet | ObservationDefinition)[] } => {
  if (item.dataType !== 'CodeableConcept') {
    throw new Error('Cannot get codeable concept obs def from non-codeable concept test item');
  }

  const { valueSetId: normalValueSetId, valueSet: normalValueSet } = makeValueSet(item.name, item.valueSet, false);
  const { valueSetId: abnormalValueSetId, valueSet: abnormalValueSet } = makeValueSet(
    item.name,
    item.abnormalValues,
    true
  );

  const containedItems: (ValueSet | ObservationDefinition)[] = [normalValueSet, abnormalValueSet];

  const obsDef: ObservationDefinition = {
    id: `contained-${sanitizeForId(item.name)}-codeableConcept-observationDef-id`,
    resourceType: 'ObservationDefinition',
    code: {
      coding: [
        ...item.loincCode.map((loincCode) => {
          return { system: 'http://loinc.org', code: loincCode };
        }),
      ],
      text: item.name,
    },
    permittedDataType: [item.dataType],
    validCodedValueSet: {
      type: 'ValueSet',
      reference: `#${normalValueSetId}`,
    },
    abnormalCodedValueSet: {
      type: 'ValueSet',
      reference: `#${abnormalValueSetId}`,
    },
  };

  containedItems.push(obsDef);

  return {
    obsDef,
    contained: containedItems,
  };
};

const getComponentObservationDefinition = (
  componentName: string,
  item: UrinalysisComponent
): { obsDef: ObservationDefinition; contained: (ValueSet | ObservationDefinition)[] } => {
  const obsDef: ObservationDefinition = {
    id: `contained-${sanitizeForId(
      componentName.toLowerCase()
    )}-component-${item.dataType.toLowerCase()}-observationDef-id`,
    resourceType: 'ObservationDefinition',
    code: {
      coding: [
        ...item.loincCode.map((loincCode) => {
          return { system: 'http://loinc.org', code: loincCode };
        }),
      ],
      text: componentName,
    },
    permittedDataType: [item.dataType],
  };

  const contained: (ValueSet | ObservationDefinition)[] = [];

  if (item.dataType === 'CodeableConcept') {
    if (!item.valueSet?.length || !item.abnormalValues?.length) {
      throw new Error(
        `valueSet or abnormalValues not defined on codeableConcept component ${componentName} ${JSON.stringify(item)}`
      );
    }

    const { valueSetId: normalValueSetId, valueSet: normalValueSet } = makeValueSet(
      componentName,
      item.valueSet,
      false
    );

    const { valueSetId: abnormalValueSetId, valueSet: abnormalValueSet } = makeValueSet(
      componentName,
      item.abnormalValues,
      true
    );

    obsDef.validCodedValueSet = {
      type: 'ValueSet',
      reference: `#${normalValueSetId}`,
    };

    obsDef.abnormalCodedValueSet = {
      type: 'ValueSet',
      reference: `#${abnormalValueSetId}`,
    };

    contained.push(normalValueSet, abnormalValueSet, obsDef);
  } else {
    if (!item.normalRange) {
      throw new Error(`No normalRange for quantity type component ${componentName} ${JSON.stringify(item)}`);
    }

    obsDef.quantitativeDetails = makeQuantitativeDetails(item);

    obsDef.qualifiedInterval = [makeQualifiedInterval(item)];
    contained.push(obsDef);
  }
  return {
    obsDef,
    contained,
  };
};

function getObservationRequirement(item: TestItem): {
  obsDefReferences: Reference[];
  contained: (ValueSet | ObservationDefinition)[];
} {
  const obsDefReferences: Reference[] = [];
  const contained: (ValueSet | ObservationDefinition)[] = [];

  if (!item.components) {
    const { obsDef, contained: containedItems } =
      item.dataType === 'CodeableConcept'
        ? getCodeableConceptObservationDefinition(item)
        : getQuantityObservationDefinition(item);

    if (!obsDef.id) {
      throw new Error('Error in obsDef generation, no id found');
    }

    obsDefReferences.push({
      type: 'ObservationDefinition',
      reference: `#${obsDef.id}`,
    });

    contained.push(...containedItems);
  } else {
    // made typescript happy to have this
    const components = item.components;

    Object.keys(item.components).forEach((key: string) => {
      const { obsDef, contained: componentContained } = getComponentObservationDefinition(key, components[key]);

      if (!obsDef.id) {
        throw new Error(`Error in obsDef generation, no id found for component ${JSON.stringify(components[key])}`);
      }
      obsDefReferences.push({
        type: 'ObservationDefinition',
        reference: `#${obsDef.id}`,
      });

      contained.push(...componentContained);
    });
  }

  return {
    obsDefReferences,
    contained,
  };
}

async function main(): Promise<void> {
  if (process.argv.length !== 3) {
    console.error(`exiting, incorrect number of arguemnts passed\n`);
    console.log(USAGE_STR);
    process.exit(1);
  }

  let ENV = process.argv[2].toLowerCase();
  ENV = ENV === 'dev' ? 'development' : ENV;

  if (!checkEnvPassedIsValid(ENV)) {
    console.error(`exiting, ENV variable passed is not valid: ${ENV}`);
    console.log(USAGE_STR);
    process.exit(2);
  }

  let envConfig: any | undefined = undefined;

  try {
    envConfig = JSON.parse(fs.readFileSync(`.env/${ENV}.json`, 'utf8'));
  } catch (e) {
    console.error(`Unable to read env file. Error: ${JSON.stringify(e)}`);
    process.exit(3);
  }

  const token = await getAuth0Token(envConfig);

  if (!token) {
    console.error('Failed to fetch auth token.');
    process.exit(4);
  }

  console.log(`Creating ActivityDefinitions on ${ENV} environment\n`);

  const oystehrClient = createOystehrClient(token, envConfig);

  const activityDefinitions: ActivityDefinition[] = [];

  for (const [_key, testData] of Object.entries(testItems)) {
    const { obsDefReferences, contained } = getObservationRequirement(testData);

    const activityDef: ActivityDefinition = {
      resourceType: 'ActivityDefinition',
      status: 'active',
      kind: 'ServiceRequest',
      code: {
        coding: [
          {
            system: IN_HOUSE_TEST_CODE_SYSTEM,
            code: testData.name,
          },
          ...testData.cptCode.map((cptCode: string) => {
            return {
              system: 'http://www.ama-assn.org/go/cpt',
              code: cptCode,
            };
          }),
        ],
      },
      title: testData.name,
      name: testData.name,
      participant: [
        {
          type: 'device',
          role: {
            coding: [
              ...Object.entries(testData.methods)
                .filter((entry): entry is [string, { device: string }] => entry[1] !== undefined)
                .map(([key, value]) => ({
                  system: IN_HOUSE_PARTICIPANT_ROLE_SYSTEM,
                  code: key,
                  display: value.device,
                })),
            ],
          },
        },
      ],
      // specimenRequirement -- nothing in the test reqs describes this
      observationRequirement: obsDefReferences,
      contained: contained,
      meta: {
        tag: [
          {
            system: IN_HOUSE_TAG_DEFINITION.system,
            code: IN_HOUSE_TAG_DEFINITION.code,
          },
        ],
      },
    };

    activityDefinitions.push(activityDef);
  }

  console.log('ActivityDefinitions: ', JSON.stringify(activityDefinitions, undefined, 2));

  const requests: BatchInputRequest<ActivityDefinition>[] = [];

  activityDefinitions.map((activityDefinition) => {
    requests.push({
      method: 'POST',
      url: '/ActivityDefinition',
      resource: activityDefinition,
    });
  });

  // make the requests to retire the pre-existing ActivityDefinitions
  (
    await oystehrClient.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        { name: '_tag', value: IN_HOUSE_TAG_DEFINITION.code },
        { name: 'status', value: 'active' },
      ],
    })
  )
    .unbundle()
    .map((activityDef) => {
      if (activityDef.id)
        requests.push({
          url: `/ActivityDefinition/${activityDef.id}`,
          method: 'PATCH',
          operations: [
            {
              op: 'replace',
              path: '/status',
              value: 'retired',
            },
          ],
        });
    });

  try {
    const oystehrResponse = await oystehrClient.fhir.transaction<ActivityDefinition>({ requests });
    console.log(JSON.stringify(oystehrResponse));
  } catch (error) {
    console.error(error);
    throw error;
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
