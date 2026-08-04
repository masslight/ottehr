import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Task } from 'fhir/r4b';
import {
  BillingInvoiceTaskClaim,
  chunkThings,
  CREATE_INVOICE_TASKS_FOR_BILLING_CLAIMS_ZAMBDA_KEY,
  CreateInvoiceTasksForBillingClaimsResponse,
  RcmTaskCodings,
} from 'utils';
import { getInvoiceTaskClaimId, getInvoiceTaskSource } from 'utils/lib/helpers/tasks/invoices-tasks';
import {
  getOrCreateInvoicingConfig,
  ParsedInvoicingConfig,
  parseInvoicingConfig,
} from '../../rcm/invoice-config/helpers';
import {
  buildInvoiceTask,
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  sendInvoiceTaskDedupeQuery,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = CREATE_INVOICE_TASKS_FOR_BILLING_CLAIMS_ZAMBDA_KEY;
const ENCOUNTER_CHUNK_SIZE = 50;

interface BillingInvoicePackage {
  claim: BillingInvoiceTaskClaim;
  encounter: Encounter;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', { claims: restOfParams.claims.length });

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect(oystehr, params.claims);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function performEffect(
  oystehr: Oystehr,
  claims: BillingInvoiceTaskClaim[]
): Promise<CreateInvoiceTasksForBillingClaimsResponse> {
  if (claims.length === 0) {
    return {
      created: 0,
      skipped: 0,
    };
  }

  console.log('Fetching invoicing config from FHIR');
  const { questionnaireResponse } = await getOrCreateInvoicingConfig(oystehr);
  const config = parseInvoicingConfig(questionnaireResponse);

  const packagesToCreate = await getClaimsWithoutTask(oystehr, claims);

  console.log(
    `Packages to create tasks for: ${packagesToCreate.length} ${JSON.stringify(
      packagesToCreate.map((pkg) => ({
        encounterId: pkg.encounter.id,
        claimId: pkg.claim.claimId,
        balance: pkg.claim.balance,
      }))
    )}`
  );

  const outcomes = await Promise.all(packagesToCreate.map((pkg) => createTaskForClaim(oystehr, pkg, config)));
  const created = outcomes.filter(Boolean).length;
  return {
    created,
    skipped: claims.length - created,
  };
}

async function getClaimsWithoutTask(
  oystehr: Oystehr,
  claims: BillingInvoiceTaskClaim[]
): Promise<BillingInvoicePackage[]> {
  const encounterIds = [...new Set(claims.map((claim) => claim.encounterId))].filter(Boolean);
  const encountersById = new Map<string, Encounter>();
  const invoiceTasksByEncounterId = new Map<string, Task[]>();

  const bundles = await Promise.all(
    chunkThings(encounterIds, ENCOUNTER_CHUNK_SIZE).map((chunk) =>
      oystehr.fhir.search<Encounter | Task>({
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

  for (const resource of bundles.flatMap((bundle) => bundle.unbundle())) {
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
  for (const claim of claims) {
    const encounter = encountersById.get(claim.encounterId);
    if (!encounter) {
      console.warn(`No clinical encounter ${claim.encounterId} found for patient AR claim ${claim.claimId}`);
      continue;
    }

    const existingTasks = invoiceTasksByEncounterId.get(claim.encounterId) ?? [];
    const taskForThisClaim = existingTasks.find((task) => getInvoiceTaskClaimId(task) === claim.claimId);
    if (taskForThisClaim) {
      console.log(`Claim ${claim.claimId} already has invoice task ${taskForThisClaim.id}; skipping`);
      continue;
    }
    if (existingTasks.length > 0) {
      const blockingTask = existingTasks[0];
      const blockingSource = getInvoiceTaskSource(blockingTask);
      console.warn(
        `Encounter ${claim.encounterId} already has a ${blockingSource}-sourced send-invoice task (${blockingTask.id}); skipping billing claim ${claim.claimId}`
      );
      continue;
    }

    result.push({
      claim,
      encounter,
    });
  }

  console.log(`Billing claims: ${claims.length} total, ${result.length} need an invoice task`);
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

async function createTaskForClaim(
  oystehr: Oystehr,
  pkg: BillingInvoicePackage,
  config: ParsedInvoicingConfig
): Promise<boolean> {
  const { claim, encounter } = pkg;
  try {
    const amountCents = Math.round(claim.balance * 100);

    console.log(`Creating task. claim: ${claim.claimId}, encounter: ${encounter.id}, balance (cents): ${amountCents}`);

    const task: Task = buildInvoiceTask({
      source: 'ottehr-billing',
      claimId: claim.claimId,
      finalizationDateIso: claim.finalizationDate,
      amountCents,
      encounter,
      config,
    });

    const created = await oystehr.fhir.create(task, {
      ifNoneExist: sendInvoiceTaskDedupeQuery(encounter.id!),
    });

    console.log(`Ensured task: ${created.id} (encounter: ${encounter.id}, claim: ${claim.claimId})`);
    return true;
  } catch (error) {
    console.error(`Failed to create task for claim ${claim.claimId}:`, error);

    captureException(error, {
      tags: {
        claimId: claim.claimId,
        encounterId: encounter.id,
      },
    });
    return false;
  }
}
