import { BatchInputRequest } from '@oystehr/sdk';
import {
  ActivityDefinition,
  CodeableConcept,
  Extension,
  ObservationDefinition,
  ObservationDefinitionQualifiedInterval,
  ObservationDefinitionQuantitativeDetails,
  Reference,
  ValueSet,
} from 'fhir/r4b';
import fs from 'fs';
import {
  IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG,
  IN_HOUSE_PARTICIPANT_ROLE_SYSTEM,
  IN_HOUSE_RESULTS_VALUESET_SYSTEM,
  IN_HOUSE_TAG_DEFINITION,
  IN_HOUSE_TEST_CODE_SYSTEM,
  IN_HOUSE_UNIT_OF_MEASURE_SYSTEM,
  LabComponentValueSetConfig,
  OD_DISPLAY_CONFIG,
  REPEATABLE_TEXT_EXTENSION_CONFIG,
} from 'utils';
import { createOystehrClient, getAuth0Token } from '../shared';

const VALID_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production'];
const USAGE_STR = `Usage: npm run make-in-house-test-items [${VALID_ENVS.join(' | ')}]\n`;

const AD_CANONICAL_URL_BASE = 'https://ottehr.com/FHIR/InHouseLab/ActivityDefinition';

const checkEnvPassedIsValid = (env: string | undefined): boolean => {
  if (!env) return false;
  return VALID_ENVS.includes(env);
};

const sanitizeForId = (str: string): string => {
  /* eslint-disable-next-line  no-useless-escape */
  return str.replace(/[ ()\/\\]/g, '');
};

const valueSetConfigDiff = (
  a: Set<LabComponentValueSetConfig>,
  b: Set<LabComponentValueSetConfig>
): Set<LabComponentValueSetConfig> => {
  const bCodes = new Set([...b].map((x) => x.code));
  return new Set([...a].filter((x) => !bCodes.has(x.code)));
};

const makeValueSet = (
  itemName: string,
  values: LabComponentValueSetConfig[],
  valueSetName: string
): { valueSetId: string; valueSet: ValueSet } => {
  const valueSetId = `contained-${sanitizeForId(itemName)}-${valueSetName.toLowerCase()}-valueSet`;

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
              code: valueStr.code,
              display: valueStr.display,
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

const makeUnitCoding = (unitStr: string): CodeableConcept => {
  return {
    coding: [
      {
        system: IN_HOUSE_UNIT_OF_MEASURE_SYSTEM,
        code: unitStr,
      },
    ],
  };
};

const makeQuantitativeDetails = (item: QuantityComponent): ObservationDefinitionQuantitativeDetails => {
  if (!item.normalRange) {
    throw new Error(`Cannot make quantitativeDetails for ${JSON.stringify(item)}`);
  }
  return {
    decimalPrecision: item.normalRange.precision,
    unit: item.normalRange.unit ? makeUnitCoding(item.normalRange.unit) : undefined,
  };
};

const makeQualifiedInterval = (item: QuantityComponent): ObservationDefinitionQualifiedInterval => {
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

const makeObsDefExtension = (item: TestItemComponent): Extension[] => {
  const display = item.display?.type as string;
  if (!display) throw new Error(`Missing display on ${item.loincCode.join(',')} item`);
  const displayExt: Extension = {
    url: OD_DISPLAY_CONFIG.url as string,
    valueString: display,
  };
  const extension: Extension[] = [displayExt];
  if (item.display?.nullOption) {
    extension.push(IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG);
  }

  return extension;
};

const makeActivityDefinitionRepeatableExtension = (item: TestItem): Extension[] => {
  const extension: Extension[] = [];
  if (item.repeatTest) {
    extension.push({
      url: REPEATABLE_TEXT_EXTENSION_CONFIG.url,
      valueString: REPEATABLE_TEXT_EXTENSION_CONFIG.valueString,
    });
  }

  return extension;
};

const getUnitForCodeableConceptType = (item: CodeableConceptComponent): CodeableConcept | undefined => {
  if (item.dataType !== 'CodeableConcept') return undefined;
  if (!item.unit) return undefined;

  return makeUnitCoding(item.unit);
};

const getComponentObservationDefinition = (
  item: TestItemComponent
): { obsDef: ObservationDefinition; contained: (ValueSet | ObservationDefinition)[] } => {
  const { componentName } = item;
  const obsDef: ObservationDefinition = {
    // changing these ids will create a backwards compatibility issue for the results page
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
    if (!item.valueSet?.length) {
      throw new Error(`valueSet not defined on codeableConcept component ${componentName} ${JSON.stringify(item)}`);
    }

    const { valueSetId: validValueSetId, valueSet: validValueSet } = makeValueSet(
      componentName,
      item.valueSet,
      'valid'
    );

    const { valueSetId: abnormalValueSetId, valueSet: abnormalValueSet } = makeValueSet(
      componentName,
      item.abnormalValues,
      'abnormal'
    );

    // the normalValueSet will serve as the reference range
    const validSet = new Set(item.valueSet);
    const abnormalSet = new Set(item.abnormalValues);
    const { valueSetId: refRangeValueSetId, valueSet: refRangeValueSet } = makeValueSet(
      componentName,
      [...valueSetConfigDiff(validSet, abnormalSet)],
      'reference-range'
    );

    obsDef.validCodedValueSet = {
      type: 'ValueSet',
      reference: `#${validValueSetId}`,
    };

    obsDef.abnormalCodedValueSet = {
      type: 'ValueSet',
      reference: `#${abnormalValueSetId}`,
    };

    obsDef.normalCodedValueSet = {
      type: 'ValueSet',
      reference: `#${refRangeValueSetId}`,
    };

    obsDef.extension = makeObsDefExtension(item);

    if (item.unit) {
      obsDef.quantitativeDetails = { unit: getUnitForCodeableConceptType(item) };
    }

    contained.push(validValueSet, abnormalValueSet, refRangeValueSet, obsDef);
  } else {
    if (!item.normalRange) {
      throw new Error(`No normalRange for quantity type component ${componentName} ${JSON.stringify(item)}`);
    }

    obsDef.quantitativeDetails = makeQuantitativeDetails(item);
    obsDef.qualifiedInterval = [makeQualifiedInterval(item)];
    obsDef.extension = makeObsDefExtension(item);
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

  item.components.forEach((item) => {
    const { obsDef, contained: componentContained } = getComponentObservationDefinition(item);

    if (!obsDef.id) {
      throw new Error(`Error in obsDef generation, no id found for component ${JSON.stringify(item)}`);
    }
    obsDefReferences.push({
      type: 'ObservationDefinition',
      reference: `#${obsDef.id}`,
    });

    contained.push(...componentContained);
  });

  return {
    obsDefReferences,
    contained,
  };
}

const getUrlAndVersion = (
  item: TestItem,
  adUrlVersionMap: { [url: string]: string }
): { url: string; version: string } => {
  const nameForUrl = item.name.split(' ').join('');
  const url = `${AD_CANONICAL_URL_BASE}/${nameForUrl}`;
  const curVersion = adUrlVersionMap[url];
  const updatedVersion = curVersion ? parseInt(curVersion) + 1 : 1;
  return { url, version: updatedVersion.toString() };
};

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

  const requests: BatchInputRequest<ActivityDefinition>[] = [];
  const adUrlVersionMap: { [url: string]: string } = {};

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
    .forEach((activityDef) => {
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
      if (activityDef.url && activityDef.version) {
        adUrlVersionMap[activityDef.url] = activityDef.version;
      }
    });

  const activityDefinitions: ActivityDefinition[] = [];

  for (const testItem of testItems) {
    const { obsDefReferences, contained } = getObservationRequirement(testItem);

    const { url: activityDefUrl, version: activityDefVersion } = getUrlAndVersion(testItem, adUrlVersionMap);

    const activityDef: ActivityDefinition = {
      resourceType: 'ActivityDefinition',
      status: 'active',
      kind: 'ServiceRequest',
      code: {
        coding: [
          {
            system: IN_HOUSE_TEST_CODE_SYSTEM,
            code: testItem.name,
          },
          ...testItem.cptCode.map((cptCode: string) => {
            return {
              system: 'http://www.ama-assn.org/go/cpt',
              code: cptCode,
            };
          }),
        ],
      },
      title: testItem.name,
      name: testItem.name,
      participant: [
        {
          type: 'device',
          role: {
            coding: [
              ...Object.entries(testItem.methods)
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
      url: activityDefUrl,
      version: activityDefVersion,
      meta: {
        tag: [
          {
            system: IN_HOUSE_TAG_DEFINITION.system,
            code: IN_HOUSE_TAG_DEFINITION.code,
          },
        ],
      },
      extension: makeActivityDefinitionRepeatableExtension(testItem),
    };

    activityDefinitions.push(activityDef);
  }

  console.log('ActivityDefinitions: ', JSON.stringify(activityDefinitions, undefined, 2));

  activityDefinitions.map((activityDefinition) => {
    requests.push({
      method: 'POST',
      url: '/ActivityDefinition',
      resource: activityDefinition,
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

// types - there are separated types and seed object which is used for the creation script only:
interface QuantityRange {
  low: number;
  high: number;
  unit: string;
  precision?: number;
}
interface TestItemMethods {
  manual?: { device: string };
  analyzer?: { device: string };
  machine?: { device: string };
}
interface BaseComponent {
  componentName: string;
  loincCode: string[];
}

export interface CodeableConceptComponent extends BaseComponent {
  dataType: 'CodeableConcept';
  valueSet: LabComponentValueSetConfig[];
  abnormalValues: LabComponentValueSetConfig[];
  display: {
    type: 'Radio' | 'Select';
    nullOption: boolean;
  };
  unit?: string;
  quantitativeReference?: Record<string, string>;
}
interface QuantityComponent extends BaseComponent {
  dataType: 'Quantity';
  normalRange: QuantityRange;
  display: {
    type: 'Numeric';
    nullOption: boolean;
  };
}

type TestItemComponent = CodeableConceptComponent | QuantityComponent;
interface TestItem {
  name: string;
  methods: TestItemMethods;
  method: string;
  device: string;
  cptCode: string[];
  loincCode: string[];
  repeatTest: boolean;
  components: TestItemComponent[];
  note?: string;
}

// seed data
const testItems: TestItem[] = [
  {
    name: 'Rapid Strep A',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
    },
    method: 'Manual',
    device: 'Strip Test (reagent strip)',
    cptCode: ['87880'],
    loincCode: ['78012-2'],
    repeatTest: false,
    components: [
      {
        componentName: 'Rapid Strep A',
        loincCode: ['78012-2'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Rapid Influenza A',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87804'],
    loincCode: ['80382-5'],
    repeatTest: false,
    components: [
      {
        componentName: 'Rapid Influenza A',
        loincCode: ['80382-5'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Rapid Influenza B',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87804'],
    loincCode: ['80381-7'],
    repeatTest: false,
    components: [
      {
        componentName: 'Rapid Influenza B',
        loincCode: ['80381-7'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Rapid RSV',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87807'],
    loincCode: ['72885-7'],
    repeatTest: false,
    components: [
      {
        componentName: 'Rapid RSV',
        loincCode: ['72885-7'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Rapid COVID-19 Antigen',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87426'],
    loincCode: ['94558-4'],
    repeatTest: false,
    components: [
      {
        componentName: 'Rapid COVID-19 Antigen',
        loincCode: ['94558-4'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Flu-Vid',
    methods: {
      analyzer: { device: 'Sofia' },
    },
    method: 'Analyzer',
    device: 'Sofia',
    cptCode: ['87428'],
    loincCode: ['80382-5', '94558-4'],
    repeatTest: false,
    components: [
      {
        componentName: 'Flu-Vid',
        loincCode: ['80382-5', '94558-4'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Stool Guaiac',
    methods: {
      manual: { device: 'None' },
    },
    method: 'Manual',
    device: '',
    cptCode: ['82270'],
    loincCode: ['50196-5'],
    repeatTest: true,
    components: [
      {
        componentName: 'Stool Guaiac',
        loincCode: ['50196-5'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Monospot test',
    methods: {
      manual: { device: 'Test well / tube' },
    },
    method: 'Manual',
    device: 'Test well / tube',
    cptCode: ['86308'],
    loincCode: ['31418-7'],
    repeatTest: false,
    components: [
      {
        componentName: 'Monospot test',
        loincCode: ['31418-7'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Glucose Finger/Heel Stick',
    methods: {
      manual: { device: 'Stick & glucometer' },
    },
    method: 'Manual with stick & glucometer',
    device: 'Glucometer brand unknown',
    cptCode: ['82962'],
    loincCode: ['32016-8'],
    repeatTest: true,
    components: [
      {
        componentName: 'Glucose',
        loincCode: ['32016-8'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 70,
          high: 140,
          unit: 'mg/dL',
        },
        display: {
          type: 'Numeric',
          nullOption: false,
        },
      },
    ],
  },
  {
    name: 'Urinalysis (UA)',
    methods: {
      analyzer: { device: 'Clinitek / Multitsix' },
    },
    method: 'Clinitek/ Multitsix',
    device: 'Clinitek',
    cptCode: ['81003'],
    loincCode: ['24356-8'],
    repeatTest: true,
    components: [
      {
        componentName: 'Glucose',
        loincCode: ['2350-7'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Not detected', display: 'Not detected' },
          { code: 'Trace', display: 'Trace' },
          { code: '1+', display: '1+' },
          { code: '2+', display: '2+' },
          { code: '3+', display: '3+' },
          { code: '4+', display: '4+' },
        ],
        abnormalValues: [
          { code: 'Trace', display: 'Trace' },
          { code: '1+', display: '1+' },
          { code: '2+', display: '2+' },
          { code: '3+', display: '3+' },
          { code: '4+', display: '4+' },
        ],
        unit: 'mg/dL',
        // currently quantitativeReference is not being mapped into the fhir resource
        // in the future, if we want we could map into the valueSet like "1+ 100 mg/dL" but not needed at the moment
        quantitativeReference: {
          Trace: '<100 mg/dL',
          '1+': '100 mg/dL',
          '2+': '250 mg/dL',
          '3+': '500 mg/dL',
          '4+': '≥1000 mg/dL',
        },
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
      {
        componentName: 'Bilirubin',
        loincCode: ['1977-8'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Not detected', display: 'Not detected' },
          { code: '1+', display: '1+' },
          { code: '2+', display: '2+' },
          { code: '3+', display: '3+' },
        ],
        abnormalValues: [
          { code: '1+', display: '1+' },
          { code: '2+', display: '2+' },
          { code: '3+', display: '3+' },
        ],
        quantitativeReference: {
          '1+': 'small',
          '2+': 'moderate',
          '3+': 'large',
        },
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
      {
        componentName: 'Ketone',
        loincCode: ['49779-2'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Not detected', display: 'Not detected' },
          { code: 'Trace', display: 'Trace' },
          { code: 'Small', display: 'Small' },
          { code: 'Moderate', display: 'Moderate' },
          { code: 'Large', display: 'Large' },
        ],
        abnormalValues: [
          { code: 'Trace', display: 'Trace' },
          { code: 'Small', display: 'Small' },
          { code: 'Moderate', display: 'Moderate' },
          { code: 'Large', display: 'Large' },
        ],
        unit: 'mg/dL',
        quantitativeReference: {
          Trace: '5 mg/dL',
          Small: '15 mg/dL',
          Moderate: '40 mg/dL',
          Large: '80-160 mg/dL',
        },
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
      {
        componentName: 'Specific gravity',
        loincCode: ['2965-2'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 1.005,
          high: 1.03,
          unit: '', // specific gravity has no unit
          precision: 3,
        },
        display: {
          type: 'Numeric',
          nullOption: false,
        },
      },
      {
        componentName: 'Blood',
        loincCode: ['105906-2'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Not detected', display: 'Not detected' },
          { code: 'Trace', display: 'Trace' },
          { code: 'Small', display: 'Small' },
          { code: 'Moderate', display: 'Moderate' },
          { code: 'Large', display: 'Large' },
        ],
        abnormalValues: [
          { code: 'Trace', display: 'Trace' },
          { code: 'Small', display: 'Small' },
          { code: 'Moderate', display: 'Moderate' },
          { code: 'Large', display: 'Large' },
        ],
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
      {
        componentName: 'pH',
        loincCode: ['2756-5'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 5.0,
          high: 8.0,
          unit: '', // ph has no unit
          precision: 1,
        },
        display: {
          type: 'Numeric',
          nullOption: false,
        },
      },
      {
        componentName: 'Protein',
        loincCode: ['2888-6'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Not detected', display: 'Not detected' },
          { code: 'Trace', display: 'Trace' },
          { code: '1+', display: '1+' },
          { code: '2+', display: '2+' },
          { code: '3+', display: '3+' },
          { code: '4+', display: '4+' },
        ],
        abnormalValues: [
          { code: 'Trace', display: 'Trace' },
          { code: '1+', display: '1+' },
          { code: '2+', display: '2+' },
          { code: '3+', display: '3+' },
          { code: '4+', display: '4+' },
        ],
        unit: 'mg/dL',
        quantitativeReference: {
          Trace: '10 mg/dL',
          '1+': '30 mg/dL',
          '2+': '100 mg/dL',
          '3+': '300 mg/dL',
          '4+': '≥2000 mg/dL',
        },
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
      {
        componentName: 'Urobilinogen',
        loincCode: ['32727-0'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 0.2,
          high: 1.0,
          unit: 'EU/dL',
          precision: 1,
        },
        display: {
          type: 'Numeric',
          nullOption: false,
        },
      },
      {
        componentName: 'Nitrite',
        loincCode: ['32710-6'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Not detected', display: 'Not detected' },
          { code: 'Detected', display: 'Detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
      {
        componentName: 'Leukocytes',
        loincCode: ['105105-1'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Not detected', display: 'Not detected' },
          { code: 'Trace', display: 'Trace' },
          { code: 'Small', display: 'Small' },
          { code: 'Moderate', display: 'Moderate' },
          { code: 'Large', display: 'Large' },
        ],
        abnormalValues: [
          { code: 'Trace', display: 'Trace' },
          { code: 'Small', display: 'Small' },
          { code: 'Moderate', display: 'Moderate' },
          { code: 'Large', display: 'Large' },
        ],
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
    ],
  },
  {
    name: 'Urine Pregnancy Test (HCG)',
    methods: {
      manual: { device: 'Strip/stick' },
    },
    method: 'Manual/Strip',
    device: 'Strip/stick',
    cptCode: ['81025'],
    loincCode: ['2106-3'],
    repeatTest: false,
    components: [
      {
        componentName: 'Urine Pregnancy Test (HCG)',
        loincCode: ['2106-3'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [], // empty array, because both results are normal in the context of the test
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Strep',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87651'],
    loincCode: ['104724-0'],
    repeatTest: false,
    components: [
      {
        componentName: 'Strep',
        loincCode: ['104724-0'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Flu A',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87501'],
    loincCode: ['104730-7'],
    repeatTest: false,
    note: 'Same CPT as Flu B, same test sample/test as B, but separate result',
    components: [
      {
        componentName: 'Flu A',
        loincCode: ['104730-7'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Flu B',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87501'],
    loincCode: ['106618-2'],
    repeatTest: false,
    note: 'Same CPT as Flu A, same test sample/test as A, but separate result',
    components: [
      {
        componentName: 'Flu B',
        loincCode: ['106618-2'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'RSV',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87634'],
    loincCode: ['33045-6', '31949-1'],
    repeatTest: false,
    components: [
      {
        componentName: 'RSV',
        loincCode: ['33045-6', '31949-1'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'COVID-19 Antigen',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87635'],
    loincCode: ['96119-3'],
    repeatTest: false,
    components: [
      {
        componentName: 'COVID-19 Antigen',
        loincCode: ['96119-3'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
];
