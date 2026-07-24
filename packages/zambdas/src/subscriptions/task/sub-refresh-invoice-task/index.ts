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

    const isZeroBalance = invoiceTaskInput.amountCents === 0;
    const updateOperations: Operation[] = [
      { op: 'replace', path: '/input', value: createInvoiceTaskInput(invoiceTaskInput) },
    ];

    if (invoiceTaskInput.finalizationDate) {
      updateOperations.push({
        op: task.authoredOn ? 'replace' : 'add',
        path: '/authoredOn',
        value: invoiceTaskInput.finalizationDate,
      });
    }

    // Ensure executionPeriod.end stays in sync with start (appointment date).
    // executionPeriod encodes the appointment date on both bounds so FHIR _sort=period
    // FHIR sorts Period by lower bound (asc) and upper bound (desc) — setting start == end makes
    // both directions sort by the appointment date correctly.
    if (task.executionPeriod?.start && task.executionPeriod.end !== task.executionPeriod.start) {
      updateOperations.push({
        op: task.executionPeriod.end ? 'replace' : 'add',
        path: '/executionPeriod/end',
        value: task.executionPeriod.start,
      });
    }

    if (isZeroBalance) {
      updateOperations.push({
        op: task.businessStatus ? 'replace' : 'add',
        path: '/businessStatus',
        value: ZERO_BALANCE_BUSINESS_STATUS,
      });
    } else if (invoiceTaskInput.amountCents !== undefined && task.businessStatus) {
      updateOperations.push({ op: 'remove', path: '/businessStatus' });
    }

    const getLastTaskOutput = getLatestTaskOutput(task);
    if (getLastTaskOutput?.type === 'success') {
      updateOperations.push({ op: 'replace', path: '/status', value: mapDisplayToInvoiceTaskStatus('sent') });
    } else if (getLastTaskOutput?.type === 'error') {
      updateOperations.push({ op: 'replace', path: '/status', value: mapDisplayToInvoiceTaskStatus('error') });
    } else {
      updateOperations.push({ op: 'replace', path: '/status', value: mapDisplayToInvoiceTaskStatus('ready') });
    }

    await oystehr.fhir.patch({
      resourceType: 'Task',
      id: taskId,
      operations: updateOperations,
    });
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
