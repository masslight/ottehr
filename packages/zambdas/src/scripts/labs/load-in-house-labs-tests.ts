import { BatchInputRequest } from '@oystehr/sdk';
import { Command } from 'commander';
import {
  ActivityDefinition,
  CodeableConcept,
  Extension,
  ObservationDefinition,
  ObservationDefinitionQualifiedInterval,
  ObservationDefinitionQuantitativeDetails,
  Reference,
  RelatedArtifact,
  ValueSet,
} from 'fhir/r4b';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG,
  IN_HOUSE_PARTICIPANT_ROLE_SYSTEM,
  IN_HOUSE_RESULTS_VALUESET_SYSTEM,
  IN_HOUSE_TAG_DEFINITION,
  IN_HOUSE_TEST_CODE_SYSTEM,
  IN_HOUSE_UNIT_OF_MEASURE_SYSTEM,
  LabComponentValueSetConfig,
  OD_DISPLAY_CONFIG,
  OD_VALUE_VALIDATION_CONFIG,
  REFLEX_ARTIFACT_DISPLAY,
  REFLEX_TEST_ALERT_URL,
  REFLEX_TEST_CONDITION_LANGUAGES,
  REFLEX_TEST_CONDITION_URL,
  REFLEX_TEST_LOGIC_URL,
  REFLEX_TEST_TO_RUN_NAME_URL,
  REFLEX_TEST_TO_RUN_URL,
  REPEATABLE_TEXT_EXTENSION_CONFIG,
  Validation,
} from 'utils';
import { createOystehrClient, getAuth0Token } from '../../shared';
import { testItems as baseTestItems } from '../data/base-in-house-lab-seed-data';

const AD_CANONICAL_URL_BASE = 'https://ottehr.com/FHIR/InHouseLab/ActivityDefinition';

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

  if (item.dataType === 'string') {
    // handle at least the string validation
    if (item.display.validations) {
      for (const [key, val] of Object.entries(item.display.validations)) {
        if (key === 'format') {
          extension.push({
            url: OD_VALUE_VALIDATION_CONFIG.url,
            valueCoding: {
              system: OD_VALUE_VALIDATION_CONFIG.formatValidation.url,
              code: val.value,
              display: val.display,
            },
          });
        }
      }
    }
  } else if (item.display?.nullOption) {
    extension.push(IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG);
  }

  return extension;
};

const makeRelatedArtifact = (item: TestItem): RelatedArtifact[] | undefined => {
  const parentTestUrls: string[] = [];
  item.components.forEach((component) => {
    if (component.reflexLogic) {
      if ('parentTestUrl' in component.reflexLogic) parentTestUrls.push(component.reflexLogic.parentTestUrl);
    }
  });
  if (parentTestUrls.length === 0) return;

  const artifacts: RelatedArtifact[] = [];
  parentTestUrls.forEach((url) => {
    const artifact: RelatedArtifact = {
      resource: url,
      type: 'depends-on',
      display: REFLEX_ARTIFACT_DISPLAY,
    };
    artifacts.push(artifact);
  });
  return artifacts;
};

const makeActivityExtension = (item: TestItem): Extension[] | undefined => {
  const extension: Extension[] = [];
  if (item.repeatTest) {
    extension.push({
      url: REPEATABLE_TEXT_EXTENSION_CONFIG.url,
      valueString: REPEATABLE_TEXT_EXTENSION_CONFIG.valueString,
    });
  }
  const reflexLogics: ReflexLogic[] = [];
  item.components.forEach((component) => {
    if (component.reflexLogic) {
      if ('testToRun' in component.reflexLogic) reflexLogics.push(component.reflexLogic);
    }
  });
  if (reflexLogics.length) {
    reflexLogics.forEach((logic) => {
      extension.push({
        url: REFLEX_TEST_LOGIC_URL,
        extension: [
          {
            url: REFLEX_TEST_TO_RUN_URL,
            valueCanonical: logic.testToRun.testCanonicalUrl,
          },
          {
            url: REFLEX_TEST_TO_RUN_NAME_URL,
            valueString: logic.testToRun.testName,
          },
          {
            url: REFLEX_TEST_ALERT_URL,
            valueString: logic.triggerAlert,
          },
          {
            url: REFLEX_TEST_CONDITION_URL,
            valueExpression: {
              description: logic.condition.description,
              language: logic.condition.language,
              expression: logic.condition.expression,
            },
          },
        ],
      });
    });
  }

  return extension.length ? extension : undefined;
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
  } else if (item.dataType === 'Quantity') {
    if (!item.normalRange) {
      throw new Error(`No normalRange for quantity type component ${componentName} ${JSON.stringify(item)}`);
    }

    obsDef.quantitativeDetails = makeQuantitativeDetails(item);
    obsDef.qualifiedInterval = [makeQualifiedInterval(item)];
    obsDef.extension = makeObsDefExtension(item);
    contained.push(obsDef);
  } else if (item.dataType === 'string') {
    obsDef.extension = makeObsDefExtension(item);
    contained.push(obsDef);
  } else {
    throw new Error(`Got unrecognized component item: ${JSON.stringify(item)}`);
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
  item: TestItem | ActivityDefinition,
  adUrlVersionMap: { [url: string]: string }
): { url: string; version: string } => {
  if (!item.name) throw new Error('Item must have a name');
  const nameForUrl = item.name.split(' ').join('');
  const url = `${AD_CANONICAL_URL_BASE}/${nameForUrl}`;
  const curVersion = adUrlVersionMap[url];
  const updatedVersion = curVersion ? parseInt(curVersion) + 1 : 1;
  return { url, version: updatedVersion.toString() };
};

async function loadData(filePath: string): Promise<TestItem[]> {
  if (filePath === 'default') {
    return baseTestItems;
  }

  const absPath = path.resolve(process.cwd(), filePath);
  const moduleUrl = pathToFileURL(absPath).href;

  const importedModule = await import(moduleUrl);

  // Named export
  if ('testItems' in importedModule) {
    return importedModule.testItems;
  }

  // Default export (if file did `export default testItems` or `export default { testItems }`)
  if (importedModule.default) {
    if ('testItems' in importedModule.default) {
      return importedModule.default.testItems;
    }
    // fallback if default is the array itself
    return importedModule.default;
  }

  throw new Error(`Could not find 'testItems' export in module: ${filePath}`);
}

const WRITE_MODES = ['api', 'json'] as const;
type WriteMode = (typeof WRITE_MODES)[number];

interface CLIOptions {
  data: string; // path to data file
  env: string;
  mode: WriteMode;
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .requiredOption('-d, --data <path>', 'Path to data file')
    .requiredOption('-e, --env <env>', 'Environment name')
    .requiredOption('-m, --mode <mode>', 'Write mode', (val): WriteMode => {
      if (!(WRITE_MODES as readonly string[]).includes(val)) {
        throw new Error(`Write mode must be one of: ${WRITE_MODES.join('|')}`);
      }
      return val as WriteMode;
    });

  program.parse(process.argv);

  // couldn't pass the type as a generic
  const options = program.opts() as CLIOptions;

  let ENV = options.env.toLowerCase();
  ENV = ENV === 'dev' ? 'development' : ENV;

  let envConfig: any;
  try {
    envConfig = JSON.parse(fs.readFileSync(`.env/${ENV}.json`, 'utf8'));
  } catch (e) {
    console.error(`Unable to read env file. Error: ${JSON.stringify(e)}`);
    process.exit(3);
  }

  // --- Dynamic import of data file from provided path ---
  const testItems: TestItem[] = await loadData(options.data);

  console.log(`Loaded ${testItems.length} items from "${options.data}"`);

  const writeMode = options.mode as WriteMode;

  const token = await getAuth0Token(envConfig);

  if (!token) {
    console.error('Failed to fetch auth token.');
    process.exit(4);
  }

  console.log(`Creating ActivityDefinitions on ${ENV} environment\n`);

  const oystehrClient = createOystehrClient(token, envConfig);

  const requests: BatchInputRequest<ActivityDefinition>[] = [];
  const adUrlVersionMap: { [url: string]: string } = {};

  const activityDefinitions: ActivityDefinition[] = [];

  for (const testItem of testItems) {
    const { obsDefReferences, contained } = getObservationRequirement(testItem);

    // this will default to version 1 at the onset which is fine, but if running in API mode, we need to figure out the current version and increment
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
      // specimenRequirement -- nothing in the test requirements describes this
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
      relatedArtifact: makeRelatedArtifact(testItem),
      extension: makeActivityExtension(testItem),
    };

    activityDefinitions.push(activityDef);
  }

  console.log('ActivityDefinitions: ', JSON.stringify(activityDefinitions, undefined, 2));

  if (writeMode === 'api') {
    console.log('write mode is api, preparing fhir requests');

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

    activityDefinitions.forEach((activityDefinition) => {
      // update the URL for the items we made so far in activityDefinitions
      const { url: activityDefUrl, version: activityDefVersion } = getUrlAndVersion(
        activityDefinition,
        adUrlVersionMap
      );
      console.log(
        `Updating new ${activityDefinition.name} version from ${activityDefinition.version} -> ${activityDefVersion}`
      );
      console.log(`Updating new ${activityDefinition.name} url from ${activityDefinition.url} -> ${activityDefUrl}`);
      requests.push({
        method: 'POST',
        url: '/ActivityDefinition',
        resource: { ...activityDefinition, version: activityDefVersion, url: activityDefUrl },
      });
    });

    try {
      const oystehrResponse = await oystehrClient.fhir.transaction<ActivityDefinition>({ requests });
      console.log(JSON.stringify(oystehrResponse));
    } catch (error) {
      console.error(error);
      throw error;
    }
    process.exit(0);
  } else if (writeMode === 'json') {
    console.log('write mode is json, preparing json output');
    fs.writeFileSync(
      'src/scripts/data/inhouse-labs-ad.json',
      JSON.stringify(activityDefinitions, undefined, 2),
      'utf8'
    );
    console.log('Successfully wrote json file. Exiting');
    process.exit(0);
  }
  console.error(`write mode not recognized: ${writeMode}`);
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

interface ReflexLogic {
  // you may want to generate the AD for the reflex test first to be sure they match
  // these need to match the reflex test activity definition
  testToRun: {
    testName: string;
    testCanonicalUrl: string;
  };
  // this what will be shown on the front end when conditions are met
  triggerAlert: string;
  condition: {
    description: string; // human readable description of what is being evaluated, purely informational
    language: typeof REFLEX_TEST_CONDITION_LANGUAGES.fhirPath; // the only language we are set up to handle at the moment, code changes are needed if we want to handle something else
    expression: string; // should be something that fhirPath can accept
  };
}
interface BaseComponent {
  componentName: string;
  loincCode: string[];
  reflexLogic?: ReflexLogic | { parentTestUrl: string };
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

// labs todo: may want to add units or a reference range in the future
interface StringComponent extends BaseComponent {
  dataType: 'string';
  display: {
    type: 'Free Text';
    validations?: Validation;
  };
}

type TestItemComponent = CodeableConceptComponent | QuantityComponent | StringComponent;
export interface TestItem {
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
