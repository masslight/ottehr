import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Task } from 'fhir/r4b';
import { chunkThings, PatientArClaimItem, RcmTaskCodings } from 'utils';
import { getInvoiceTaskClaimId, getInvoiceTaskSource } from 'utils/lib/helpers/tasks/invoices-tasks';
import { fetchAllActivePatientArClaims } from '../../billing/search-billing-patient-ar-claims/handler';
import { createBillingClient, createEraReadClient } from '../../billing/shared';
import {
  getOrCreateInvoicingConfig,
  ParsedInvoicingConfig,
  parseInvoicingConfig,
} from '../../rcm/invoice-config/helpers';
import {
  buildInvoiceTask,
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  isOttehrBillingInvoicingEnabled,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'create-billing-invoices-tasks';
const ENCOUNTER_CHUNK_SIZE = 50;

interface BillingInvoicePackage {
  item: PatientArClaimItem;
  encounter: Encounter;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!isOttehrBillingInvoicingEnabled(secrets)) {
    console.log('Ottehr billing invoicing is disabled for this env (BILLING_INTEGRATION or feature flag); skipping');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Ottehr billing invoicing disabled, no tasks created' }),
    };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const clinicalClient = createClinicalOystehrClient(m2mToken, secrets);
  const billingClient = createBillingClient(m2mToken, secrets);
  const eraReadClient = createEraReadClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect({
    clinicalClient,
    billingClient,
    eraReadClient,
  });
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

interface PerformEffectParams {
  clinicalClient: Oystehr;
  billingClient: Oystehr;
  eraReadClient: Oystehr;
}

async function performEffect(params: PerformEffectParams): Promise<{ message: string }> {
  const { clinicalClient, billingClient, eraReadClient } = params;

  console.log('Fetching invoicing config from FHIR');
  const { questionnaireResponse } = await getOrCreateInvoicingConfig(clinicalClient);
  const invoicingConfig = parseInvoicingConfig(questionnaireResponse);

  const arClaims = await fetchAllActivePatientArClaims({
    billingClient,
    eraReadClient,
  });
  console.log(`Active patient AR claims: ${arClaims.length}`);

  const linkedClaims = arClaims.filter((item) => {
    if (item.encounterId) return true;
    const error = new Error(`Patient AR claim ${item.claimId} has no encounter linkage; cannot create invoice task`);
    console.warn(error.message);
    captureException(error, {
      tags: {
        claimId: item.claimId,
      },
    });
    return false;
  });

  const packagesToCreate = await getClaimsWithoutTask({
    clinicalClient,
    items: linkedClaims,
  });

  console.log(
    `Packages to create tasks for: ${packagesToCreate.length} ${JSON.stringify(
      packagesToCreate.map((pkg) => ({
        encounterId: pkg.encounter.id,
        claimId: pkg.item.claimId,
        balance: pkg.item.balance,
      }))
    )}`
  );

  await Promise.all(
    packagesToCreate.map((pkg) =>
      createTaskForClaim({
        clinicalClient,
        pkg,
        config: invoicingConfig,
      })
    )
  );

  return { message: 'Successfully created tasks for billing claims' };
}

async function getClaimsWithoutTask(params: {
  clinicalClient: Oystehr;
  items: PatientArClaimItem[];
}): Promise<BillingInvoicePackage[]> {
  const { clinicalClient, items } = params;
  if (items.length === 0) return [];

  const encounterIds = [...new Set(items.map((item) => item.encounterId ?? ''))].filter(Boolean);
  const encountersById = new Map<string, Encounter>();
  const invoiceTasksByEncounterId = new Map<string, Task[]>();

  const bundles = await Promise.all(
    chunkThings(encounterIds, ENCOUNTER_CHUNK_SIZE).map((chunk) =>
      clinicalClient.fhir.search<Encounter | Task>({
        resourceType: 'Encounter',
        params: [
          {
            name: '_id',
            value: chunk.join(','),
          },
          {
            name: '_count',
            value: String(chunk.length),
          },
          {
            name: '_revinclude',
            value: 'Task:encounter',
          },
        ],
      })
    )
  );

  const bundleFlatMap = bundles.flatMap((bundle) => bundle.unbundle());
  for (const resource of bundleFlatMap) {
    if (resource.resourceType === 'Encounter' && resource.id) {
      encountersById.set(resource.id, resource);
    }
    if (resource.resourceType === 'Task' && isSendInvoiceTask(resource)) {
      const encounterId = resource.encounter?.reference?.replace('Encounter/', '');
      if (!encounterId) continue;
      const list = invoiceTasksByEncounterId.get(encounterId) ?? [];
      list.push(resource);
      invoiceTasksByEncounterId.set(encounterId, list);
    }
  }

  const result: BillingInvoicePackage[] = [];
  for (const item of items) {
    const encounterId = item.encounterId ?? '';
    const encounter = encountersById.get(encounterId);
    if (!encounter) {
      const error = new Error(`No clinical encounter ${encounterId} found for patient AR claim ${item.claimId}`);
      console.warn(error.message);
      captureException(error, {
        tags: {
          claimId: item.claimId,
          encounterId,
        },
      });
      continue;
    }

    const existingTasks = invoiceTasksByEncounterId.get(encounterId) ?? [];
    const taskForThisClaim = existingTasks.find((task) => getInvoiceTaskClaimId(task) === item.claimId);
    if (taskForThisClaim) {
      console.log(`Claim ${item.claimId} already has invoice task ${taskForThisClaim.id}; skipping`);
      continue;
    }
    if (existingTasks.length > 0) {
      const blockingTask = existingTasks[0];
      const blockingSource = getInvoiceTaskSource(blockingTask);
      const error = new Error(
        `Encounter ${encounterId} already has a ${blockingSource}-sourced send-invoice task (${blockingTask.id}); skipping billing claim ${item.claimId}`
      );
      console.warn(error.message);
      captureException(error, {
        tags: {
          claimId: item.claimId,
          encounterId,
          blockingSource,
        },
      });
      continue;
    }

    result.push({
      item,
      encounter,
    });
  }

  console.log(`Billing claims: ${items.length} total, ${result.length} need an invoice task`);
  return result;
}

const sendInvoiceCoding = RcmTaskCodings.sendInvoiceToPatient.coding?.[0];

function isSendInvoiceTask(task: Task): boolean {
  return Boolean(
    task.code?.coding?.some(
      (coding) => coding.system === sendInvoiceCoding?.system && coding.code === sendInvoiceCoding?.code
    )
  );
}

async function createTaskForClaim(params: {
  clinicalClient: Oystehr;
  pkg: BillingInvoicePackage;
  config: ParsedInvoicingConfig;
}): Promise<void> {
  const { clinicalClient, pkg, config } = params;
  try {
    const { item, encounter } = pkg;
    const amountCents = Math.round(item.balance * 100);

    console.log(
      `Creating task. patient: ${item.patientId}, claim: ${item.claimId}, encounter: ${encounter.id}, balance (cents): ${amountCents}`
    );

    const task: Task = buildInvoiceTask({
      source: 'ottehr-billing',
      claimId: item.claimId,
      finalizationDateIso: item.finalizationDate,
      amountCents,
      encounter,
      config,
    });

    const created = await clinicalClient.fhir.create(task);

    console.log(`Created task: ${created.id} (encounter: ${encounter.id}, claim: ${item.claimId})`);
  } catch (error) {
    console.error(`Failed to create task for claim ${pkg.item.claimId}:`, error);

    captureException(error, {
      tags: {
        claimId: pkg.item.claimId,
        encounterId: pkg.encounter.id,
      },
    });
  }
}
