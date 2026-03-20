/**
 * Backfill script: populate executionPeriod, authoredOn and businessStatus (and finalization date with claim id in input) on existing sendInvoiceToPatient Tasks.
 *
 * Usage:
 *   e.g.: tsx scripts/backfill-invoice-task-execution-period.ts
 */
import Oystehr from '@oystehr/sdk';
import { CandidApiClient, CandidApiEnvironment } from 'candidhealth';
import { InventoryRecord } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, Encounter as FhirEncounter, Resource, Task as FhirTask, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createInvoiceTaskInput,
  findClaimsBy,
  getStartTimeFromEncounterStatusHistory,
  parseInvoiceTaskInput,
  RCM_TASK_SYSTEM,
  RcmTaskCode,
  ZERO_BALANCE_BUSINESS_STATUS,
  ZERO_BALANCE_BUSINESS_STATUS_CODE,
} from 'utils';
import { getCandidEncounterIdFromEncounter } from 'zambdas/src/shared';

const PAGE_SIZE = 100;

interface TaskGroup {
  task: FhirTask;
  encounter: FhirEncounter;
  appointment?: Appointment;
  inventoryRecord?: InventoryRecord;
}

async function createOyst(): Promise<Oystehr> {
  const secrets = {
    FHIR_API: 'https://fhir-api.zapehr.com/r4',
    PROJECT_API: 'https://project-api.zapehr.com/v1',
    PROJECT_ID: '<>',
    token: '<your-token>',
  };
  const oystehr = new Oystehr({
    accessToken: secrets.token,
    projectId: secrets.PROJECT_ID,
    services: {
      fhirApiUrl: secrets.FHIR_API,
      projectApiUrl: secrets.PROJECT_API,
    },
  });
  console.log(`Created Oystehr client`);
  return oystehr;
}

async function createCandid(): Promise<CandidApiClient> {
  const secrets = {
    CANDID_CLIENT_ID: '<client-id>',
    CANDID_CLIENT_SECRET: '<client-secret>',
    CANDID_ENV: 'STAGING',
  };
  const candidEnv = secrets.CANDID_ENV === 'PROD' ? CandidApiEnvironment.Production : CandidApiEnvironment.Staging;
  console.log(`Creating Candid client`);

  return new CandidApiClient({
    clientId: secrets.CANDID_CLIENT_ID,
    clientSecret: secrets.CANDID_CLIENT_SECRET,
    environment: candidEnv,
  });
}

function findResourceById<T extends Resource>(
  resourceType: Resource['resourceType'],
  id: string | undefined,
  resources: Resource[]
): T | undefined {
  if (!id) return undefined;
  return resources.find((res) => res.resourceType === resourceType && res.id === id) as T;
}

const backfillTasks = async (): Promise<void> => {
  const oystehr = await createOyst();
  const candid = await createCandid();

  let offset = 0;
  let totalProcessed = 0;
  let totalPatched = 0;
  let hasMore = true;

  console.log('Starting backfill of executionPeriod, authoredOn and businessStatus on invoice Tasks...');

  while (hasMore) {
    console.log(`Fetching tasks with offset ${offset}...`);
    const bundle = await oystehr.fhir.search({
      resourceType: 'Task',
      params: [
        { name: 'code', value: `${RCM_TASK_SYSTEM}|${RcmTaskCode.sendInvoiceToPatient}` },
        { name: '_include', value: 'Task:encounter' },
        { name: '_count', value: PAGE_SIZE },
        { name: '_offset', value: offset },
        { name: '_total', value: 'accurate' },
        { name: '_sort', value: '-authored-on,-_id' },
        {
          name: '_include:iterate',
          value: 'Encounter:appointment',
        },
      ],
    });

    const resources = bundle.unbundle() as Resource[];
    const tasks = resources.filter((r) => r.resourceType === 'Task') as Task[];
    const encounters = resources.filter((r) => r.resourceType === 'Encounter') as Encounter[];

    const taskGroups: TaskGroup[] = [];

    tasks.forEach((task) => {
      const encounterId = task.encounter?.reference?.replace('Encounter/', '');
      const encounter = findResourceById<FhirEncounter>('Encounter', encounterId, resources);
      if (!encounter) {
        console.error(
          `Task with id: ${task.id} was not included in the bundle because it's missing encounter with id: ${encounterId}`
        );
        return;
      }

      const appointmentId = encounter.appointment
        ?.find((ref) => ref.reference?.includes('Appointment/'))
        ?.reference?.replace('Appointment/', '');
      const appointment = findResourceById<Appointment>('Appointment', appointmentId, resources);

      taskGroups.push({
        task,
        encounter,
        appointment,
      });
    });

    console.log(`  Page: ${tasks.length} tasks, ${encounters.length} encounters`);

    const candidEncounterIdsToLookFor: string[] = [];
    let earliestEncounterDate = DateTime.fromISO(getStartTimeFromEncounterStatusHistory(taskGroups[0].encounter));
    taskGroups.forEach((group) => {
      const { task, encounter } = group;
      const input = parseInvoiceTaskInput(task);
      if (!input.finalizationDate) {
        const candidEncounterId = getCandidEncounterIdFromEncounter(encounter);
        if (candidEncounterId) {
          candidEncounterIdsToLookFor.push(candidEncounterId);
          const encounterStart = DateTime.fromISO(getStartTimeFromEncounterStatusHistory(encounter));
          if (encounterStart.isValid && encounterStart < earliestEncounterDate) earliestEncounterDate = encounterStart;
        }
      }
    });

    if (candidEncounterIdsToLookFor.length > 0) {
      const inventoryRecords = await findClaimsBy({
        candid,
        candidEncountersIds: candidEncounterIdsToLookFor,
        since: earliestEncounterDate,
      });
      taskGroups.forEach((group) => {
        const candidEncounterId = getCandidEncounterIdFromEncounter(group.encounter);
        const ir = inventoryRecords.find((ir) => ir.encounterId === candidEncounterId);
        if (ir) {
          group.inventoryRecord = ir;
        }
      });
    }

    for (const group of taskGroups) {
      const { task, appointment, inventoryRecord } = group;
      totalProcessed++;

      const taskInput = parseInvoiceTaskInput(task);
      const appointmentDateISO = appointment.start;
      const finalizationDateISO = taskInput.finalizationDate ?? inventoryRecord?.timestamp.toISOString();
      const amountCents = taskInput.amountCents ?? 0;
      const isZeroBalance = amountCents === 0;

      // A task is fully backfilled when:
      //   - executionPeriod.start == executionPeriod.end (both set to appointment date)
      //   - authoredOn == finalizationDate (or no finalizationDate available)
      // const executionPeriodCorrect =
      //   task.executionPeriod?.start &&
      //   task.executionPeriod.start === task.executionPeriod.end &&
      //   task.executionPeriod.start === appointmentDateISO;
      // const authoredOnCorrect = !finalizationDateISO || task.authoredOn === finalizationDateISO;

      const operations: Operation[] = [];

      if (!task.executionPeriod) {
        console.log('gonna add executionPeriod to this task: ', task.id);
        operations.push({
          op: 'add',
          path: '/executionPeriod',
          value: {
            ...(appointmentDateISO ? { start: appointmentDateISO, end: appointmentDateISO } : {}),
          },
        });
      } else if (task.executionPeriod.start !== appointmentDateISO || task.executionPeriod.end !== appointmentDateISO) {
        console.log('gonna update executionPeriod of this task: ', task.id);
        operations.push({
          op: 'replace',
          path: '/executionPeriod',
          value: {
            ...(appointmentDateISO ? { start: appointmentDateISO, end: appointmentDateISO } : {}),
          },
        });
      }

      if (!taskInput.finalizationDate && finalizationDateISO) {
        const newInput = {
          ...taskInput,
          memo: taskInput.memo ?? 'empty',
          finalizationDate: finalizationDateISO,
          claimId: inventoryRecord?.claimId.toString(),
        };
        console.log('input raw: ', JSON.stringify(taskInput));
        console.log('gonna update input: ', JSON.stringify(createInvoiceTaskInput(newInput)));
        operations.push({
          op: 'replace',
          path: '/input',
          value: createInvoiceTaskInput(newInput),
        });
      }

      if (finalizationDateISO && task.authoredOn !== finalizationDateISO) {
        console.log('gonna update authoredOn for task: ', task.id);
        operations.push({
          op: task.authoredOn ? 'replace' : 'add',
          path: '/authoredOn',
          value: finalizationDateISO,
        });
      }

      if (isZeroBalance && !task.businessStatus) {
        console.log('gonna add businessStatus to this task: ', task.id);
        operations.push({ op: 'add', path: '/businessStatus', value: ZERO_BALANCE_BUSINESS_STATUS });
      } else if (!isZeroBalance && task.businessStatus?.coding?.[0]?.code === ZERO_BALANCE_BUSINESS_STATUS_CODE) {
        console.log('gonna remove businessStatus from this task: ', task.id);
        operations.push({ op: 'remove', path: '/businessStatus' });
      }

      if (operations.length === 0) {
        continue;
      }

      try {
        await oystehr.fhir.patch({ resourceType: 'Task', id: task.id!, operations });
        totalPatched++;
        console.log(
          `  Patched task ${task.id} (appt: ${appointmentDateISO ?? 'n/a'}, authoredOn/finalization: ${
            finalizationDateISO ?? 'n/a'
          }, zeroBalance: ${isZeroBalance})`
        );
      } catch (err) {
        console.error(`  ERROR patching task ${task.id}:`, err);
      }
    }

    if (tasks.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  console.log(`\nBackfill complete. Processed: ${totalProcessed}, Patched: ${totalPatched}`);
};

void backfillTasks();
