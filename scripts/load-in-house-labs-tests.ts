import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { ActivityDefinition, ObservationDefinition, Reference, ValueSet } from 'fhir/r4b';
import * as readline from 'readline';
import { testItems, TestItem } from '../packages/utils/lib/fhir/inHouseActivityDefinitionHandler';

function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

const getCodeableConceptObservationDefinition = (
  item: TestItem
): { obsDef: ObservationDefinition; contained: ValueSet[] } => {
  if (item.dataType !== 'CodeableConcept') {
    throw new Error('Cannot get codeable concept obs def from non-codeable concept test item');
  }

  const containedItems: ValueSet[] = [];

  const codeableObsDef: ObservationDefinition = {
    id: `contained-${item.name}-obs-def-id`,
    resourceType: 'ObservationDefinition',
    code: {
      coding: [
        ...item.loincCode.map((loincCode) => {
          return { system: 'http://loinc.org', code: loincCode };
        }),
      ],
      text: item.name,
    },
    permittedDataType: ['CodeableConcept'],
    validCodedValueSet: {
      type: 'ValueSet',
      reference: 'TODO: add validCodedValueSet',
    }, // TODO: these need to be references to contained valuesets
    normalCodedValueSet: {
      type: 'ValueSet',
      reference: 'TODO: add normalCodedValueSet',
    },
  };

  return {
    obsDef: codeableObsDef,
    contained: containedItems,
  };
};

function getObservationReq(item: TestItem): {
  references: Reference[];
  observationDefinitions: ObservationDefinition[];
} {
  if (!item.components) {
    const { obsDef: _obsDef, contained: _contained } =
      item.dataType === 'CodeableConcept'
        ? getCodeableConceptObservationDefinition(item)
        : { obsDef: undefined, contained: undefined };
    // : getQuantityObservationDefinition(item);
  }

  return { references: [], observationDefinitions: [] };
}

async function main(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const projectId = (await askQuestion(rl, 'Enter project id: ')).trim();
  const accessToken = (await askQuestion(rl, 'Enter access token: ')).trim();

  rl.close();

  console.log('Project id: ', projectId);
  console.log('Access Token: ', accessToken);

  const oysterClient = new Oystehr({
    accessToken: accessToken,
    projectId: projectId,
  });

  const actividtyDefinitions: ActivityDefinition[] = [];

  for (const key of Object.keys(testItems)) {
    const testData: TestItem = testItems[key];

    // TODO: gets the observationdefinitions out here because they will be contained resources (and themselves have contained valuesets)

    const activityDef: ActivityDefinition = {
      resourceType: 'ActivityDefinition',
      status: 'active',
      kind: 'ServiceRequest',
      code: {
        coding: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-test-code', // TODO: make constant
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
              ...Object.keys(testData.methods).map((key: string) => {
                return {
                  system: 'http://ottehr.org/fhir/StructureDefinition/in-house-test-participant-role',
                  code: key,
                  display: testData.methods[key].device,
                };
              }),
            ],
          },
        },
      ],
      // specimenRequirement -- nothing in the test reqs describes this
      meta: {
        tag: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-codes',
            code: 'in-house-lab-test-definition',
          },
        ],
      },
      observationRequirement: getObservationReq(testData).references,
    };

    actividtyDefinitions.push(activityDef);
  }

  const requests: BatchInputRequest<ActivityDefinition>[] = [];

  // TODO: make the create requests

  try {
    const oystehrResponse = await oysterClient.fhir.batch<ActivityDefinition>({ requests });
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
