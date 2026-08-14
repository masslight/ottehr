import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { InventoryRecord, InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Operation } from 'fast-json-patch';
import { Encounter, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getStartTimeFromEncounterStatusHistory, patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import { findClaimsBy, getOrCreateCandidApiClient } from 'utils/lib/helpers/candidApi';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  createInvoiceTaskInput,
  getLatestTaskOutput,
  mapDisplayToInvoiceTaskStatus,
} from 'utils/lib/helpers/tasks/invoices-tasks';
import { getInvoiceTaskClaimId, getInvoiceTaskSource } from 'utils/lib/helpers/tasks/invoices-tasks';
import { InvoiceTaskInput, ZERO_BALANCE_BUSINESS_STATUS } from 'utils/lib/types/api/invoicing.types';
import { SearchBillingPatientARClaimsResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { getCandidEncounterIdFromEncounter } from '../../../shared/candid';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
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
    // timeout, a concurrent update-invoice-task write), and an op that assumes a path exists
    // (`replace`, `remove`) is rejected outright if that guess is wrong. Re-read the resource so the
    // patch is built against what is actually stored.
    const currentTask = (await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId })) as Task & { id: string };

    // Re-reading narrows the window in which a concurrent write can invalidate a path we expect to
    // exist, but it cannot close it. Patching under the version we read turns that lost race into a
    // 412 rather than a patch built on a guess that no longer holds, and since every operation is a
    // pure function of the stored Task, the retry recomputes them against what the winning write left.
    await patchWithOptimisticLock(oystehr, currentTask, (freshTask) =>
      buildUpdateOperations(freshTask, invoiceTaskInput)
    );

    console.log(`Updated task input for task id: "${taskId}"`);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Task was successfully updated.' }),
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
 * Builds the patch for the refreshed invoice data against the Task as it is currently stored. Every
 * decision here — `add` vs `replace`, whether to remove `businessStatus`, which status the send's
 * output implies — is read off `currentTask` rather than the subscription payload, so re-running this
 * with a re-fetched Task after an optimistic-locking conflict yields a patch valid for that version.
 */
function buildUpdateOperations(currentTask: Task, invoiceTaskInput: InvoiceTaskInput): Operation[] {
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

  // A send that finished after this event was queued has already written its output and status, and
  // deriving the status from the stale payload would roll that back to "ready".
  const getLastTaskOutput = getLatestTaskOutput(currentTask);
  if (getLastTaskOutput?.type === 'success') {
    updateOperations.push({ op: 'replace', path: '/status', value: mapDisplayToInvoiceTaskStatus('sent') });
  } else if (getLastTaskOutput?.type === 'error') {
    updateOperations.push({ op: 'replace', path: '/status', value: mapDisplayToInvoiceTaskStatus('error') });
  } else {
    updateOperations.push({ op: 'replace', path: '/status', value: mapDisplayToInvoiceTaskStatus('ready') });
  }

  return updateOperations;
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
