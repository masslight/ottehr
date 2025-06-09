import { BatchInputRequest } from '@oystehr/sdk';
import { ActivityDefinition, ValueSet, Extension, ValueSetExpansionContains } from 'fhir/r4b';
import fs from 'fs';
import { getAuth0Token, createOystehrClient } from '../shared';
import {
  MEDICATIONS_USED_VALUE_SET_URL,
  BODY_SITES_VALUE_SET_URL,
  BODY_SIDES_VALUE_SET_URL,
  TECHNIQUES_VALUE_SET_URL,
  SUPPLIES_VALUE_SET_URL,
  COMPLICATIONS_VALUE_SET_URL,
  PATIENT_RESPONSES_VALUE_SET_URL,
  POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL,
  TIME_SPENT_VALUE_SET_URL,
  PROCEDURE_TYPES_VALUE_SET_URL,
  PROCEDURE_TYPE_CPT_EXTENSION_URL,
} from 'utils';

const VALID_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo'];
const USAGE_STR = `Usage: npm run make-in-house-test-items [${VALID_ENVS.join(' | ')}]\n`;
const STUB = 'stub';

const checkEnvPassedIsValid = (env: string | undefined): boolean => {
  if (!env) return false;
  return VALID_ENVS.includes(env);
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

  console.log(`Creating ValueSets on ${ENV} environment\n`);

  const oystehrClient = createOystehrClient(token, envConfig);

  const requests: BatchInputRequest<ValueSet>[] = [];

  (
    await oystehrClient.fhir.search<ActivityDefinition>({
      resourceType: 'ValueSet',
      params: [
        { name: 'url', value: valueSets.map((valueSet) => valueSet.url).join(',') },
        { name: 'status', value: 'active' },
      ],
    })
  )
    .unbundle()
    .forEach((valueSet) => {
      requests.push({
        url: `/ValueSet/${valueSet.id}`,
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

  valueSets.forEach((valueSet) => {
    requests.push({
      method: 'POST',
      url: '/ValueSet',
      resource: valueSet,
    });
  });

  console.log(`Transaction requests:\n${JSON.stringify(requests, null, 2)}`);

  try {
    const oystehrResponse = await oystehrClient.fhir.transaction<ValueSet>({ requests });
    console.log(`Transaction response:\n${JSON.stringify(oystehrResponse, null, 2)}`);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

const valueSets: ValueSet[] = [
  createProcedureTypeValueSet(),
  createSimpleValueSet(MEDICATIONS_USED_VALUE_SET_URL, []),
  createSimpleValueSet(BODY_SITES_VALUE_SET_URL, []),
  createSimpleValueSet(BODY_SIDES_VALUE_SET_URL, []),
  createSimpleValueSet(TECHNIQUES_VALUE_SET_URL, []),
  createSimpleValueSet(SUPPLIES_VALUE_SET_URL, []),
  createSimpleValueSet(COMPLICATIONS_VALUE_SET_URL, []),
  createSimpleValueSet(PATIENT_RESPONSES_VALUE_SET_URL, []),
  createSimpleValueSet(POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL, []),
  createSimpleValueSet(TIME_SPENT_VALUE_SET_URL, []),
];

function createProcedureTypeValueSet(): ValueSet {
  return {
    resourceType: 'ValueSet',
    url: PROCEDURE_TYPES_VALUE_SET_URL,
    status: 'active',
    expansion: {
      timestamp: new Date().toISOString(),
      contains: [
        valueSetEntry('Laceration Repair (Suturing/Stapling)'),
        valueSetEntry('Wound Care / Dressing Change'),
        valueSetEntry('Splint Application / Immobilization'),
        valueSetEntry('Incision and Drainage (I&D) of Abscess'),
        valueSetEntry('Reduction of Nursemaid’s Elbow'),
        valueSetEntry('Burn Treatment / Dressing'),
        valueSetEntry('Foreign Body Removal (Skin, Ear, Nose, Eye)'),
        {
          ...valueSetEntry('Nail Trephination (Subungual Hematoma Drainage)'),
          extension: [procedureCptCodeExtension('11740', 'Evacuation of subungual hematoma')],
        },
        {
          ...valueSetEntry('Tick or Insect Removal'),
          extension: [
            procedureCptCodeExtension('10120', 'Incision and removal of foreign body, subcutaneous tissues; simple'),
          ],
        },
        valueSetEntry('Staple or Suture Removal'),
        valueSetEntry('Intravenous (IV) Catheter Placement'),
        valueSetEntry('IV Fluid Administration'),
        {
          ...valueSetEntry('Intramuscular (IM) Medication Injection'),
          extension: [
            procedureCptCodeExtension(
              '96372',
              'Therapeutic, prophylactic, or diagnostic injection (specify substance or drug); subcutaneous or intramuscular'
            ),
          ],
        },
        {
          ...valueSetEntry('Nebulizer Treatment (e.g., Albuterol)'),
          extension: [
            procedureCptCodeExtension(
              '94640',
              'Pressurized or nonpressurized inhalation treatment for acute airway obstruction for therapeutic purposes and/or for diagnostic purposes such as sputum induction with an aerosol generator, nebulizer, metered dose inhaler or intermittent positive pressure breathing (IPPB) device'
            ),
          ],
        },
        valueSetEntry('Oral Rehydration / Medication Administration (including challenge doses)'),
        {
          ...valueSetEntry('Wart Treatment (Cryotherapy with Liquid Nitrogen'),
          extension: [
            procedureCptCodeExtension(
              '17110',
              'Destruction (eg, laser surgery, electrosurgery, cryosurgery, chemosurgery, surgical curettement), of benign lesions other than skin tags or cutaneous vascular proliferative lesions; up to 14 lesions'
            ),
          ],
        },
        valueSetEntry('Urinary Catheterization'),
        valueSetEntry('Ear Lavage / Cerumen Removal'),
        {
          ...valueSetEntry('Nasal Packing (Epistaxis Control)'),
          extension: [
            procedureCptCodeExtension(
              '30901',
              'Control nasal hemorrhage, anterior, simple (limited cautery and/or packing) any method'
            ),
          ],
        },
        valueSetEntry('Eye Irrigation or Eye Foreign Body Removal'),
        valueSetEntry('Nasal Lavage (schnozzle)'),
        {
          ...valueSetEntry('EKG'),
          extension: [
            procedureCptCodeExtension(
              '93000',
              'Electrocardiogram, routine ECG with at least 12 leads; with interpretation and report'
            ),
          ],
        },
      ],
    },
  };
}

function procedureCptCodeExtension(code: string, display: string): Extension {
  return {
    url: PROCEDURE_TYPE_CPT_EXTENSION_URL,
    valueCodeableConcept: {
      coding: [
        {
          system: STUB,
          code,
          display,
        },
      ],
    },
  };
}

function createSimpleValueSet(url: string, values: string[]): ValueSet {
  const valueSet: ValueSet = {
    resourceType: 'ValueSet',
    url: url,
    status: 'active',
    expansion: {
      timestamp: new Date().toISOString(),
      contains: [],
    },
  };
  values.forEach((value) => valueSet.expansion?.contains?.push(valueSetEntry(value)));
  return valueSet;
}

function valueSetEntry(value: string): ValueSetExpansionContains {
  return {
    system: STUB,
    code: STUB,
    display: value,
  };
}
