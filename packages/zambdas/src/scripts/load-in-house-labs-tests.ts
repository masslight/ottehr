import { BatchInputRequest } from '@oystehr/sdk';
import {
  ActivityDefinition,
  ObservationDefinition,
  Reference,
  ValueSet,
  ObservationDefinitionQuantitativeDetails,
  ObservationDefinitionQualifiedInterval,
} from 'fhir/r4b';
import fs from 'fs';
import { getAuth0Token, createOystehrClient } from '../shared';
import {
  IN_HOUSE_PARTICIPANT_ROLE_SYSTEM,
  IN_HOUSE_RESULTS_VALUESET_SYSTEM,
  IN_HOUSE_TAG_DEFINITION,
  IN_HOUSE_TEST_CODE_SYSTEM,
  IN_HOUSE_UNIT_OF_MEASURE_SYSTEM,
} from 'utils';

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

const makeQuantitativeDetails = (item: QuantityTestItem | MixedComponent): ObservationDefinitionQuantitativeDetails => {
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

const makeQualifiedInterval = (item: QuantityTestItem | MixedComponent): ObservationDefinitionQualifiedInterval => {
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
  item: MixedComponent
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

// there are separated types and seed object which is used for the creation script only:

interface QuantityRange {
  low: number;
  high: number;
  unit: string;
  precision?: number;
}

interface MixedComponent {
  loincCode: string[];
  dataType: 'CodeableConcept' | 'Quantity'; // Using literal types instead of ResultType['dataType']
  valueSet?: string[];
  abnormalValues?: string[];
  normalRange?: QuantityRange;
  quantitativeReference?: Record<string, string>;
}

interface BaseTestItem {
  name: string;
  methods: TestItemMethods;
  method: string;
  device: string;
  cptCode: string[];
  loincCode: string[];
  // repeatTest: boolean;
  note?: string;
  components?: Record<string, MixedComponent>;
}

interface TestItemMethods {
  manual?: { device: string };
  analyzer?: { device: string };
  machine?: { device: string };
}

interface CodeableConceptTestItem extends BaseTestItem {
  dataType: 'CodeableConcept';
  valueSet: string[];
  abnormalValues: string[];
}

interface QuantityTestItem extends BaseTestItem {
  dataType: 'Quantity';
  unit: string;
  normalRange: QuantityRange;
}

type TestItem = CodeableConceptTestItem | QuantityTestItem;

type TestItemsType = Record<string, TestItem>;

const testItems: TestItemsType = {
  'Rapid Strep A': {
    name: 'Rapid Strep A',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
    },
    method: 'Manual',
    device: 'Strip Test (reagent strip)',
    cptCode: ['87880'],
    loincCode: ['78012-2'],
    // repeatTest: true,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Rapid Influenza A': {
    name: 'Rapid Influenza A',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87804'],
    loincCode: ['80382-5'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Rapid Influenza B': {
    name: 'Rapid Influenza B',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87804'],
    loincCode: ['80381-7'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Rapid RSV': {
    name: 'Rapid RSV',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87807'],
    loincCode: ['72885-7'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Rapid COVID-19 Antigen': {
    name: 'Rapid COVID-19 Antigen',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87426'],
    loincCode: ['94558-4'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Flu-Vid': {
    name: 'Flu-Vid',
    methods: {
      analyzer: { device: 'Sofia' },
    },
    method: 'Analyzer',
    device: 'Sofia',
    cptCode: ['87428'],
    loincCode: ['80382-5', '94558-4'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Stool Guaiac': {
    name: 'Stool Guaiac',
    methods: {
      manual: { device: 'None' },
    },
    method: 'Manual',
    device: '',
    cptCode: ['82270'],
    loincCode: ['50196-5'],
    // repeatTest: true,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Monospot test': {
    name: 'Monospot test',
    methods: {
      manual: { device: 'Test well / tube' },
    },
    method: 'Manual',
    device: 'Test well / tube',
    cptCode: ['86308'],
    loincCode: ['31418-7'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Glucose Finger/Heel Stick': {
    name: 'Glucose Finger/Heel Stick',
    methods: {
      manual: { device: 'Stick & glucometer' },
    },
    method: 'Manual with stick & glucometer',
    device: 'Glucometer brand unknown',
    cptCode: ['82962'],
    loincCode: ['32016-8'],
    // repeatTest: true,
    dataType: 'Quantity' as const,
    unit: 'mg/dL',
    normalRange: {
      low: 70,
      high: 140,
      unit: 'mg/dL',
    },
  },
  'Urinalysis (UA)': {
    name: 'Urinalysis (UA)',
    methods: {
      analyzer: { device: 'Clinitek / Multitsix' },
    },
    method: 'Clinitek/ Multitsix',
    device: 'Clinitek',
    cptCode: ['81003'],
    loincCode: ['24356-8'],
    // repeatTest: true,
    dataType: 'CodeableConcept' as const,
    valueSet: [], // empty value set, because the test itself has no values, only components
    abnormalValues: [],
    components: {
      Glucose: {
        loincCode: ['2350-7'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Negative', 'Trace', '1+', '2+', '3+', '4+'],
        abnormalValues: ['Trace', '1+', '2+', '3+', '4+'],
        quantitativeReference: {
          Trace: '<100 mg/dL',
          '1+': '100 mg/dL',
          '2+': '250 mg/dL',
          '3+': '500 mg/dL',
          '4+': '≥1000 mg/dL',
        },
      },
      Bilirubin: {
        loincCode: ['1977-8'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Negative', '1+', '2+', '3+'],
        abnormalValues: ['1+', '2+', '3+'],
        quantitativeReference: {
          '1+': 'small',
          '2+': 'moderate',
          '3+': 'large',
        },
      },
      Ketone: {
        loincCode: ['49779-2'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Negative', 'Trace', 'Small', 'Moderate', 'Large'],
        abnormalValues: ['Trace', 'Small', 'Moderate', 'Large'],
        quantitativeReference: {
          Trace: '5 mg/dL',
          Small: '15 mg/dL',
          Moderate: '40 mg/dL',
          Large: '80-160 mg/dL',
        },
      },
      'Specific gravity': {
        loincCode: ['2965-2'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 1.005,
          high: 1.03,
          unit: '', // specific gravity has no unit
          precision: 3,
        },
      },
      Blood: {
        loincCode: ['105906-2'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Negative', 'Trace', 'Small', 'Moderate', 'Large'],
        abnormalValues: ['Trace', 'Small', 'Moderate', 'Large'],
      },
      pH: {
        loincCode: ['2756-5'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 5.0,
          high: 8.0,
          unit: '', // ph has no unit
          precision: 1,
        },
      },
      Protein: {
        loincCode: ['2888-6'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Negative', 'Trace', '1+', '2+', '3+', '4+'],
        abnormalValues: ['Trace', '1+', '2+', '3+', '4+'],
        quantitativeReference: {
          Trace: '10 mg/dL',
          '1+': '30 mg/dL',
          '2+': '100 mg/dL',
          '3+': '300 mg/dL',
          '4+': '≥2000 mg/dL',
        },
      },
      Urobilinogen: {
        loincCode: ['32727-0'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 0.2,
          high: 1.0,
          unit: 'EU/dL',
          precision: 1,
        },
      },
      Nitrite: {
        loincCode: ['32710-6'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Positive', 'Negative'],
        abnormalValues: ['Positive'],
      },
      Leukocytes: {
        loincCode: ['105105-1'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Negative', 'Trace', 'Small', 'Moderate', 'Large'],
        abnormalValues: ['Trace', 'Small', 'Moderate', 'Large'],
      },
    },
  },
  'Urine Pregnancy Test (HCG)': {
    name: 'Urine Pregnancy Test (HCG)',
    methods: {
      manual: { device: 'Strip/stick' },
    },
    method: 'Manual/Strip',
    device: 'Strip/stick',
    cptCode: ['81025'],
    loincCode: ['2106-3'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: [], // empty array, because both results are normal in the context of the test
  },
  Strep: {
    name: 'Strep',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87651'],
    loincCode: ['104724-0'],
    // repeatTest: true,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Flu A': {
    name: 'Flu A',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87501'],
    loincCode: ['104730-7'],
    // repeatTest: true,
    note: 'Same CPT as Flu B, same test sample/test as B, but separate result',
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Flu B': {
    name: 'Flu B',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87501'],
    loincCode: ['106618-2'],
    // repeatTest: true,
    note: 'Same CPT as Flu A, same test sample/test as A, but separate result',
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  RSV: {
    name: 'RSV',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87634'],
    loincCode: ['33045-6', '31949-1'],
    // repeatTest: true,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'COVID-19 Antigen': {
    name: 'COVID-19 Antigen',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87635'],
    loincCode: ['96119-3'],
    // repeatTest: true,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
};
