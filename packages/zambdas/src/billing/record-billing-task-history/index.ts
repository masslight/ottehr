import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { RcmTaskCode } from 'utils/lib/fhir/constants';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { getInvoiceTaskClaimId, getInvoiceTaskSource } from 'utils/lib/helpers/tasks/invoices-tasks';
import { RecordBillingTaskHistoryResponse } from 'utils/lib/types/data/billing/billing.types';
import { CLAIM_HISTORY_TASK_LABELS } from 'utils/lib/types/data/billing/claim-history';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { findBillingClaimForEncounter } from '../payments';
import { claimEventProvenanceRequest, claimHistoryHasEntryFor, resolveClaimActor } from '../provenance';
import { createBillingClient } from '../shared';
import { RecordBillingTaskHistoryParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'record-billing-task-history';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  console.group('complexValidation');
  const validatedParams = await complexValidation(oystehr, params);
  console.groupEnd();
  console.debug('complexValidation success');

  console.group('performEffect');
  const response = await performEffect(oystehr, validatedParams);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

interface ValidatedParams extends RecordBillingTaskHistoryParams {
  claimId: string | undefined;
}

export async function complexValidation(
  oystehr: Oystehr,
  params: RecordBillingTaskHistoryParams
): Promise<ValidatedParams> {
  return {
    ...params,
    claimId: await taskClaimId(oystehr, params.task),
  };
}

// An invoice task names its claim, and one Candid sent belongs to no Ottehr claim. Other billing
// tasks are tied to their claim through the encounter.
async function taskClaimId(oystehr: Oystehr, task: Task): Promise<string | undefined> {
  if (task.code?.coding?.some((coding) => coding.code === RcmTaskCode.sendInvoiceToPatient)) {
    return getInvoiceTaskSource(task) === 'ottehr-billing' ? getInvoiceTaskClaimId(task) : undefined;
  }
  const encounterId = [task.encounter?.reference, task.focus?.reference]
    .map((reference) => removePrefix('Encounter/', reference ?? ''))
    .find(Boolean);
  if (!encounterId) return undefined;
  return (await findBillingClaimForEncounter(oystehr, encounterId))?.id;
}

export async function performEffect(
  oystehr: Oystehr,
  params: ValidatedParams
): Promise<RecordBillingTaskHistoryResponse> {
  const { task, previousTask, claimId, secrets } = params;
  if (!claimId) {
    console.log(`Task/${task.id} belongs to no billing claim; nothing to record`);
    return {
      recorded: false,
    };
  }

  const targetReference = `Task/${task.id}`;
  const taskVersion = `${targetReference}/_history/${task.meta?.versionId}`;
  // subscriptions redeliver, so each Task version is recorded once
  if (
    await claimHistoryHasEntryFor({
      oystehr,
      claimId,
      targetReference,
      sourceReference: taskVersion,
    })
  ) {
    return {
      recorded: false,
    };
  }

  const provenance = claimEventProvenanceRequest({
    targetReference,
    targetDisplay: CLAIM_HISTORY_TASK_LABELS[task.code?.coding?.[0]?.code ?? ''],
    claimId,
    before: previousTask,
    after: task,
    sourceReference: taskVersion,
    agent: await resolveClaimActor('system', oystehr, undefined, secrets),
    activity: previousTask ? 'update' : 'create',
  });
  if (!provenance) {
    return {
      recorded: false,
    };
  }
  await oystehr.fhir.create(provenance.resource);
  return {
    recorded: true,
  };
}
