import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { InventoryRecord, InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Operation } from 'fast-json-patch';
import { Encounter, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  chooseJson,
  createInvoiceTaskInput,
  findClaimsBy,
  getLatestTaskOutput,
  getOrCreateCandidApiClient,
  getStartTimeFromEncounterStatusHistory,
  mapDisplayToInvoiceTaskStatus,
  SearchBillingPatientARClaimsResponse,
  ZERO_BALANCE_BUSINESS_STATUS,
} from 'utils';
import { getInvoiceTaskClaimId, getInvoiceTaskSource } from 'utils/lib/helpers/tasks/invoices-tasks';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  getCandidEncounterIdFromEncounter,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'sub-refresh-invoice-task';

interface RefreshedInvoiceData {
  finalizationDateIso: string;
  claimId?: string;
  amountCents?: number;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParams = validateRequestParameters(input);
  const { task, secrets, invoiceTaskInput, taskId } = validatedParams;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const source = getInvoiceTaskSource(task);
  console.log(`Refreshing ${source} invoice task ${taskId}`);

  let refreshed: RefreshedInvoiceData | undefined;
  if (source === 'ottehr-billing') {
    refreshed = await getBillingRefreshData(oystehr, task);
  } else {
    const candid = await getOrCreateCandidApiClient(oystehr, secrets);
    refreshed = await getCandidRefreshData({
      oystehr,
      candid,
      taskId,
    });
  }

  if (refreshed) {
    if (refreshed.finalizationDateIso) {
      invoiceTaskInput.finalizationDate = refreshed.finalizationDateIso;
      console.log('Updating finalization date: ', invoiceTaskInput.finalizationDate);
    }

    if (!invoiceTaskInput.claimId && refreshed.claimId) {
      invoiceTaskInput.claimId = refreshed.claimId;
      console.log('Updating claim id: ', invoiceTaskInput.claimId);
    }

    if (refreshed.amountCents !== undefined) {
      invoiceTaskInput.amountCents = refreshed.amountCents;
      console.log('Updating amount cents: ', invoiceTaskInput.amountCents);
    }
    console.log('Updating task input...', JSON.stringify(createInvoiceTaskInput(invoiceTaskInput), null, 2));

    // The `task` we were handed is the subscription payload — a snapshot taken when the event was
    // queued. It can be stale by the time we get here (duplicate deliveries, redelivery after a
    // timeout, a concurrent update-invoice-task write), and every op below whose `op` depends on a
    // path already existing (`replace`, `remove`) is rejected outright if that guess is wrong.
    // Re-read the resource so those decisions are based on what is actually stored.
    const currentTask = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });

    const isZeroBalance = invoiceTaskInput.amountCents === 0;
    const updateOperations: Operation[] = [
      { op: 'replace', path: '/input', value: createInvoiceTaskInput(invoiceTaskInput) },
    ];

    if (invoiceTaskInput.finalizationDate) {
      updateOperations.push({
        op: currentTask.authoredOn ? 'replace' : 'add',
        path: '/authoredOn',
        value: invoiceTaskInput.finalizationDate,
      });
    }

    // Ensure executionPeriod.end stays in sync with start (appointment date).
    // executionPeriod encodes the appointment date on both bounds so FHIR _sort=period
    // FHIR sorts Period by lower bound (asc) and upper bound (desc) — setting start == end makes
    // both directions sort by the appointment date correctly.
    if (currentTask.executionPeriod?.start && currentTask.executionPeriod.end !== currentTask.executionPeriod.start) {
      updateOperations.push({
        op: currentTask.executionPeriod.end ? 'replace' : 'add',
        path: '/executionPeriod/end',
        value: currentTask.executionPeriod.start,
      });
    }

    if (isZeroBalance) {
      updateOperations.push({
        op: currentTask.businessStatus ? 'replace' : 'add',
        path: '/businessStatus',
        value: ZERO_BALANCE_BUSINESS_STATUS,
      });
    } else if (invoiceTaskInput.amountCents !== undefined && currentTask.businessStatus) {
      updateOperations.push({ op: 'remove', path: '/businessStatus' });
    }

    // Also read off the stored task: a send that finished after this event was queued has already
    // written its output and status, and deriving the status from the stale payload would roll that
    // back to "ready".
    const getLastTaskOutput = getLatestTaskOutput(currentTask);
    if (getLastTaskOutput?.type === 'success') {
      updateOperations.push({ op: 'replace', path: '/status', value: mapDisplayToInvoiceTaskStatus('sent') });
    } else if (getLastTaskOutput?.type === 'error') {
      updateOperations.push({ op: 'replace', path: '/status', value: mapDisplayToInvoiceTaskStatus('error') });
    } else {
      updateOperations.push({ op: 'replace', path: '/status', value: mapDisplayToInvoiceTaskStatus('ready') });
    }

    const droppedOperations = await patchTaskTolerantOfMissingPaths(oystehr, taskId, updateOperations);
    console.log(`Updated task input for task id: "${taskId}"`);
    const droppedNote = droppedOperations.length
      ? ` Operations that no longer applied were dropped: ${describeOperations(droppedOperations)}.`
      : '';
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Task was successfully updated.${droppedNote}` }),
    };
  }

  const missingRecordLabel = source === 'ottehr-billing' ? 'patient AR claim' : 'Candid inventory record';
  const notUpdatedMessage = `Task was not updated because no ${missingRecordLabel} was found for the task.`;
  console.warn(notUpdatedMessage);
  await oystehr.fhir.patch({
    resourceType: 'Task',
    id: taskId,
    operations: [{ op: 'replace', path: '/status', value: mapDisplayToInvoiceTaskStatus('error') }],
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ message: notUpdatedMessage }),
  };
});

/**
 * Statuses the FHIR API may answer with when a patch targets a path that does not exist. Both are
 * plausible for what is ultimately a client error, and the exact choice is a server detail — pinning
 * this to a single code risks making the fallback below silently inert, which is the failure mode it
 * exists to prevent. For the same reason the status is read structurally instead of through
 * `instanceof Oystehr.OystehrSdkError`.
 */
const PATCH_PATH_REJECTION_STATUSES = new Set([400, 422]);

const describeOperations = (operations: Operation[]): string =>
  operations.map((operation) => `${operation.op} ${operation.path}`).join(', ');

/**
 * Applies `operations` to the Task, retrying once without the `remove` ops if the whole patch is
 * rejected over a path that does not exist. Returns the ops that had to be dropped — empty when the
 * first attempt succeeded.
 *
 * Re-reading the Task before building the patch narrows the window in which a concurrent write can
 * invalidate a path we expect to exist, but it cannot close it. `remove` is the only op here that
 * hard-fails on an already-absent path (RFC 6902), and since the patch is applied atomically that
 * one lost race would otherwise discard the input/authoredOn/status updates too, leaving the task
 * stuck in "updating". Dropping the removes and retrying converges on the same end state, because
 * the field we wanted gone is already gone. The retry is a strict subset of the original ops, so a
 * rejection with some other cause simply fails again and propagates.
 *
 * The caller is expected to surface the returned ops: a retry that succeeds still means we gave up
 * on clearing a field, and that has to be visible rather than reported as an unqualified success.
 */
async function patchTaskTolerantOfMissingPaths(
  oystehr: Oystehr,
  taskId: string,
  operations: Operation[]
): Promise<Operation[]> {
  try {
    await oystehr.fhir.patch({ resourceType: 'Task', id: taskId, operations });
    return [];
  } catch (error) {
    const status =
      (error as { code?: number; statusCode?: number })?.code ?? (error as { statusCode?: number })?.statusCode;
    const removals = operations.filter((operation) => operation.op === 'remove');
    if (!PATCH_PATH_REJECTION_STATUSES.has(status as number) || removals.length === 0) {
      throw error;
    }
    console.warn(
      `Patch for task "${taskId}" was rejected with status ${status}; retrying without ${describeOperations(
        removals
      )}. Original error:`,
      error
    );
    await oystehr.fhir.patch({
      resourceType: 'Task',
      id: taskId,
      operations: operations.filter((operation) => operation.op !== 'remove'),
    });
    return removals;
  }
}

async function getBillingRefreshData(oystehr: Oystehr, task: Task): Promise<RefreshedInvoiceData | undefined> {
  const claimId = getInvoiceTaskClaimId(task);
  if (!claimId) {
    console.warn(`Billing-sourced task ${task.id} has no claim id identifier`);
    return undefined;
  }

  const response = chooseJson<SearchBillingPatientARClaimsResponse>(
    await oystehr.zambda.execute({
      id: 'search-billing-patient-ar-claims',
      claimIds: [claimId],
      includeZeroBalance: true,
    })
  );
  const item = response.claims.find((claim) => claim.claimId === claimId);
  if (!item) return undefined;

  console.log(`Found patient AR record for claim ${claimId}, balance: ${item.balance}`);
  return {
    finalizationDateIso: item.finalizationDate,
    claimId: item.claimId,
    amountCents: Math.round(item.balance * 100),
  };
}

async function getCandidRefreshData(params: {
  oystehr: Oystehr;
  candid: CandidApiClient;
  taskId: string;
}): Promise<RefreshedInvoiceData | undefined> {
  const { oystehr, candid, taskId } = params;
  const inventoryRecord = await getCandidInventoryRecordForTask(oystehr, candid, taskId);
  if (!inventoryRecord) return undefined;

  console.log(`Found inventory record for task, ${JSON.stringify(inventoryRecord)}`);
  const itemization = await getItemizationForClaim(candid, inventoryRecord.claimId);
  if (itemization) console.log(`Found itemization for claim`);

  return {
    finalizationDateIso: inventoryRecord.timestamp.toISOString(),
    claimId: inventoryRecord.claimId.toString(),
    amountCents: itemization?.patientBalanceCents,
  };
}

async function getCandidInventoryRecordForTask(
  oystehr: Oystehr,
  candid: CandidApiClient,
  taskId: string
): Promise<InventoryRecord | undefined> {
  const resources = (
    await oystehr.fhir.search({
      resourceType: 'Task',
      params: [
        {
          name: '_id',
          value: taskId,
        },
        {
          name: '_include',
          value: 'Task:encounter',
        },
      ],
    })
  ).unbundle();
  const encounter = resources.find((res) => res.resourceType === 'Encounter') as Encounter | undefined;
  if (encounter) {
    const candidEncounterId = getCandidEncounterIdFromEncounter(encounter);
    const startFromIso = getStartTimeFromEncounterStatusHistory(encounter);
    const startFromDate = startFromIso ? DateTime.fromISO(startFromIso) : undefined;
    if (candidEncounterId && startFromDate && startFromDate.isValid) {
      return (
        await findClaimsBy({
          candid,
          candidEncountersIds: [candidEncounterId],
          since: startFromDate,
        })
      )?.find((record) => record.encounterId === candidEncounterId);
    }
  }
  return undefined;
}

async function getItemizationForClaim(
  candid: CandidApiClient,
  claimId: string
): Promise<InvoiceItemizationResponse | undefined> {
  const itemizationResponse = await candid.patientAr.v1.itemize(CandidApi.ClaimId(claimId));
  if (itemizationResponse && itemizationResponse.ok && itemizationResponse.body) {
    return itemizationResponse.body as InvoiceItemizationResponse;
  }
  return undefined;
}
