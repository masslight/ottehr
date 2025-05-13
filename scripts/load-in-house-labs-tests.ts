import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import {
  ActivityDefinition,
  ObservationDefinition,
  Reference,
  ValueSet,
  ObservationDefinitionQuantitativeDetails,
  ObservationDefinitionQualifiedInterval,
} from 'fhir/r4b';
import * as readline from 'readline';
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

function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

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
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const projectId = (await askQuestion(rl, 'Enter project id: ')).trim();
  const accessToken = (await askQuestion(rl, 'Enter access token: ')).trim();

  rl.close();

  const oysterClient = new Oystehr({
    accessToken: accessToken,
    projectId: projectId,
  });

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

  const requests: BatchInputRequest<ActivityDefinition>[] = activityDefinitions.map((activityDefinition) => {
    return {
      method: 'POST',
      url: '/ActivityDefinition',
      resource: activityDefinition,
    };
  });

  try {
    const oystehrResponse = await oysterClient.fhir.transaction<ActivityDefinition>({ requests });
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
