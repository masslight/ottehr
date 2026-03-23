import Oystehr from '@oystehr/sdk';
import { SearchParam } from '@oystehr/sdk/dist/esm';
import { CandidApiClient, CandidApiEnvironment } from 'candidhealth';
import { InventoryRecord } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Encounter, Task } from 'fhir/r4b';
import fs from 'fs';
import { createInvoiceTaskInput, findClaimsBy, parseInvoiceTaskInput, RCM_TASK_SYSTEM, RcmTaskCode } from 'utils';
import { getCandidEncounterIdFromEncounter } from 'zambdas/src/shared';

interface TaskGroup {
  task: Task;
  encounter: Encounter;
}

async function createOyst(zambdaEnv: Record<string, string>, token: string): Promise<Oystehr> {
  const oystehr = new Oystehr({
    accessToken: token,
    projectId: '<projID>',
    services: {
      fhirApiUrl: zambdaEnv.FHIR_API,
      projectApiUrl: zambdaEnv.PROJECT_API,
    },
  });
  console.log(`Created Oystehr client`);
  return oystehr;
}

async function createCandid(
  zambdaEnv: Record<string, string>,
  candidEnv: CandidApiEnvironment
): Promise<CandidApiClient> {
  const candidClientId = zambdaEnv.CANDID_CLIENT_ID || '';
  const candidClientSecret = zambdaEnv.CANDID_CLIENT_SECRET || '';
  console.log(`Creating Candid client`);

  return new CandidApiClient({
    clientId: candidClientId,
    clientSecret: candidClientSecret,
    environment: candidEnv,
  });
}

async function main(): Promise<void> {
  const environment: 'local' | 'development' | 'testing' | 'staging' | 'production' = 'local';
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const candidEnv = environment === 'production' ? CandidApiEnvironment.Production : CandidApiEnvironment.Staging;
  const token = '<oyst-key-here>';

  console.log(`Reading environment variables from packages/zambdas/.env/${environment}.json.`);
  const zambdaEnv: Record<string, string> = JSON.parse(
    fs.readFileSync(`packages/zambdas/.env/${environment}.json`, 'utf8')
  );
  const oystehr = await createOyst(zambdaEnv, token);
  const candid = await createCandid(zambdaEnv, candidEnv);

  let page = 0;
  const pageSize = 100;
  let tasksGroups = await getTasksPaginated(oystehr, 0, pageSize);
  console.log('Total tasks: ', tasksGroups.total);
  // const allPages = Math.ceil(tasksGroups.total / pageSize);
  const allPages = 2;

  do {
    const tasksMissingData: TaskGroup[] = [];
    tasksGroups.groups.forEach((group) => {
      const taskInput = parseInvoiceTaskInput(group.task);
      if (!taskInput.claimId || !taskInput.finalizationDate || !group.task.for) {
        tasksMissingData.push(group);
      }
    });

    const candidEncounterIdsToLookFor: string[] = [];
    tasksMissingData.forEach((group) => {
      const candidEncounterId = getCandidEncounterIdFromEncounter(group.encounter);
      candidEncounterIdsToLookFor.push(candidEncounterId);
    });

    const inventoryRecords = await findClaimsBy({ candid, candidEncountersIds: candidEncounterIdsToLookFor });
    console.log('Found claims: ', inventoryRecords.length);

    const promises: Promise<void>[] = [];
    tasksMissingData.forEach((group) => {
      const inventoryRecord = inventoryRecords.find(
        (record) => record.encounterId === getCandidEncounterIdFromEncounter(group.encounter)
      );
      if (inventoryRecord) {
        promises.push(updateTask(oystehr, group, inventoryRecord));
      }
    });
    await Promise.all(promises);

    tasksGroups = await getTasksPaginated(oystehr, page);
    page++;
  } while (page < allPages - 1);
}

async function getTasksPaginated(
  oystehr: Oystehr,
  pageNumber: number,
  pageSize = 100
): Promise<{ groups: TaskGroup[]; total: number }> {
  const params: SearchParam[] = [
    {
      name: '_sort',
      value: '-authored-on',
    },
    {
      name: '_total',
      value: 'accurate',
    },
    {
      name: '_count',
      value: pageSize,
    },
    {
      name: 'code',
      value: `${RCM_TASK_SYSTEM}|${RcmTaskCode.sendInvoiceToPatient}`,
    },
    {
      name: '_include',
      value: 'Task:encounter',
    },
    {
      name: '_offset',
      value: pageNumber * pageSize,
    },
  ];

  const bundle = await oystehr.fhir.search({
    resourceType: 'Task',
    params,
  });

  const resources = bundle.unbundle();
  const tasks = resources.filter((r) => r.resourceType === 'Task') as Task[];
  console.log('Tasks found: ', tasks.length);

  const resultGroups: TaskGroup[] = [];
  tasks.forEach((task) => {
    const encounterId = task.encounter?.reference?.replace('Encounter/', '');
    const encounter = resources.find((res) => res.resourceType === 'Encounter' && res.id === encounterId) as Encounter;
    if (!encounter) {
      console.error(
        `Task with id: ${task.id} was not included in the bundle because it's missing encounter with id: ${encounterId}`
      );
      return;
    }

    resultGroups.push({
      task,
      encounter,
    });
  });
  return { groups: resultGroups, total: bundle.total ?? 0 };
}

async function updateTask(oystehr: Oystehr, group: TaskGroup, inventoryRecord: InventoryRecord): Promise<void> {
  try {
    const taskInput = parseInvoiceTaskInput(group.task);
    taskInput.claimId = inventoryRecord.claimId.toString();
    taskInput.finalizationDate = inventoryRecord.timestamp.toISOString();

    const patientRef = group.encounter.subject;
    console.log(
      `Adding to task: ${group.task.id}, patientRef: ${patientRef.reference}, claimId: ${taskInput.claimId}, finalizationDate: ${taskInput.finalizationDate}`
    );

    await oystehr.fhir.patch({
      resourceType: 'Task',
      id: group.task.id,
      operations: [
        { op: 'replace', path: '/input', value: createInvoiceTaskInput(taskInput) },
        { op: 'add', path: '/for', value: patientRef },
      ],
    });
  } catch (e) {
    console.error(`Error updating task: ${group.task.id} with error: ${e.message ?? e.toString() ?? 'unknown error'}`);
  }
}

main().catch((error) => {
  console.log('Error: ', error);
});
