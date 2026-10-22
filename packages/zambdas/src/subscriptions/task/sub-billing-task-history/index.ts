import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import {
  OUTREACH_ACTION_TYPE_SYSTEM,
  OUTREACH_TASK_TAG_SYSTEM,
} from '../../../rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import { ActionType, TriggerEvent } from '../../../rcm/scheduled-outreach-config/helpers';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { shouldUseOttehrBilling } from '../../../shared/candid';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'sub-billing-task-history';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const { task, secrets } = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!shouldUseOttehrBilling(secrets) || !isBillingTask(task)) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        forwarded: false,
      }),
    };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  console.group('performEffect');
  await performEffect(oystehr, task);
  console.groupEnd();
  console.debug('performEffect success');

  return {
    statusCode: 200,
    body: JSON.stringify({
      forwarded: true,
    }),
  };
});

// Outreach also sends birthday greetings and visit follow-ups, which are not part of a claim.
const BILLING_OUTREACH_ACTIONS: ActionType[] = ['charge-card', 'refer-to-collections'];
const BILLING_OUTREACH_TRIGGERS: TriggerEvent[] = ['invoice-issued', 'invoice-due'];

export function isBillingTask(task: Task): boolean {
  const outreachAction = task.code?.coding?.find((coding) => coding.system === OUTREACH_ACTION_TYPE_SYSTEM)?.code;
  if (!outreachAction) return true;
  const trigger = task.meta?.tag?.find((tag) => tag.system === OUTREACH_TASK_TAG_SYSTEM)?.code;
  return (
    BILLING_OUTREACH_ACTIONS.some((action) => action === outreachAction) ||
    BILLING_OUTREACH_TRIGGERS.some((triggerEvent) => triggerEvent === trigger)
  );
}

export async function performEffect(oystehr: Oystehr, task: Task): Promise<void> {
  const previousTask = await previousVersion(oystehr, task);
  await oystehr.zambda.execute({
    id: 'record-billing-task-history',
    task,
    ...(previousTask ? { previousTask } : {}),
  });
}

async function previousVersion(oystehr: Oystehr, task: Task): Promise<Task | undefined> {
  const history = await oystehr.fhir.history<Task>({
    resourceType: 'Task',
    id: task.id!,
  });
  const versions = (history.entry ?? [])
    .flatMap((entry) => (entry.resource?.meta?.lastUpdated ? [entry.resource] : []))
    .sort((a, b) => (b.meta?.lastUpdated ?? '').localeCompare(a.meta?.lastUpdated ?? ''));
  const index = versions.findIndex((version) => version.meta?.versionId === task.meta?.versionId);
  return index === -1 ? undefined : versions[index + 1];
}
