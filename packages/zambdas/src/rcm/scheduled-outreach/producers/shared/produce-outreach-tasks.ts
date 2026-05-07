import Oystehr from '@oystehr/sdk';
import { PlanDefinition, Reference, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils';
import {
  ActionType,
  DunningAction,
  getOrCreateDunningConfig,
  parsePlanDefinitionToActions,
  TriggerEvent,
} from '../../../dunning-config/helpers';

const RCM_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/rcm`;
export const OUTREACH_TASK_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/outreach-task`;
const OUTREACH_ACTION_TYPE_SYSTEM = 'https://ottehr.com/CodeSystem/outreach-action-type';

export interface ProduceOutreachTasksParams {
  triggerEvent: TriggerEvent;
  patient: Reference;
  focus: Reference; // Invoice, Encounter, etc.
  eventTimestamp: string; // ISO datetime the event occurred/is scheduled
  oystehr: Oystehr;
}

export interface OutreachTaskResult {
  created: Task[];
  skipped: { actionId: string; reason: string }[];
}

/**
 * Reads the PlanDefinition, filters actions matching the trigger event,
 * checks for existing tasks (idempotency), and creates draft Tasks for each
 * matching action with executionPeriod.start calculated from event time + offset.
 */
export async function produceOutreachTasks(params: ProduceOutreachTasksParams): Promise<OutreachTaskResult> {
  const { triggerEvent, patient, focus, eventTimestamp, oystehr } = params;

  const planDefinition = await getOrCreateDunningConfig(oystehr);
  const actions = parsePlanDefinitionToActions(planDefinition);

  const matchingActions = actions.filter((a) => a.trigger.event === triggerEvent);

  if (matchingActions.length === 0) {
    console.log(`No outreach actions configured for trigger event "${triggerEvent}"`);
    return { created: [], skipped: [] };
  }

  // Check for existing tasks to avoid duplicates
  const existingTasks = await findExistingOutreachTasks(oystehr, focus, triggerEvent);
  const existingActionIds = new Set(existingTasks.map((t) => extractActionIdFromTask(t)).filter(Boolean));

  const result: OutreachTaskResult = { created: [], skipped: [] };

  for (const action of matchingActions) {
    if (existingActionIds.has(action.id)) {
      result.skipped.push({ actionId: action.id, reason: 'Task already exists' });
      continue;
    }

    const dueDateTime = calculateDueDateTime(eventTimestamp, action);
    const task = buildOutreachTask(action, planDefinition, patient, focus, dueDateTime);
    const created = await oystehr.fhir.create<Task>(task);
    result.created.push(created);
  }

  console.log(
    `produceOutreachTasks: trigger="${triggerEvent}", focus=${focus.reference}, ` +
      `created=${result.created.length}, skipped=${result.skipped.length}`
  );

  return result;
}

/**
 * Calculate the absolute due datetime from event timestamp + action offset.
 */
function calculateDueDateTime(eventTimestamp: string, action: DunningAction): string {
  const eventDt = DateTime.fromISO(eventTimestamp);
  const timeUnit = action.trigger.timeUnit || 'days';
  const direction = action.trigger.direction || 'after';
  const offset = action.trigger.daysAfter;

  const luxonUnit = timeUnit === 'days' ? 'days' : timeUnit === 'hours' ? 'hours' : 'minutes';
  const signedOffset = direction === 'before' ? -offset : offset;

  return eventDt.plus({ [luxonUnit]: signedOffset }).toISO()!;
}

/**
 * Query for existing outreach tasks for a given focus resource and trigger event.
 */
async function findExistingOutreachTasks(
  oystehr: Oystehr,
  focus: Reference,
  triggerEvent: TriggerEvent
): Promise<Task[]> {
  const bundle = await oystehr.fhir.search<Task>({
    resourceType: 'Task',
    params: [
      { name: 'focus', value: focus.reference! },
      { name: '_tag', value: `${OUTREACH_TASK_TAG_SYSTEM}|${triggerEvent}` },
      { name: 'status', value: 'draft,requested,in-progress' },
    ],
  });
  return bundle.unbundle();
}

/**
 * Extract the outreach action ID stored in a task's tag.
 */
function extractActionIdFromTask(task: Task): string | undefined {
  return task.meta?.tag?.find((t) => t.system === `${OUTREACH_TASK_TAG_SYSTEM}/action-id`)?.code;
}

/**
 * Build a draft FHIR Task for a single outreach action.
 */
function buildOutreachTask(
  action: DunningAction,
  planDefinition: PlanDefinition,
  patient: Reference,
  focus: Reference,
  dueDateTime: string
): Omit<Task, 'id'> {
  return {
    resourceType: 'Task',
    status: 'draft',
    intent: 'order',
    code: {
      coding: [
        {
          system: OUTREACH_ACTION_TYPE_SYSTEM,
          code: action.actionType,
          display: actionTypeDisplay(action.actionType),
        },
      ],
    },
    description: `Outreach: ${actionTypeDisplay(action.actionType)} triggered by ${action.trigger.event}`,
    for: patient,
    focus: focus,
    basedOn: [{ reference: `PlanDefinition/${planDefinition.id}` }],
    executionPeriod: {
      start: dueDateTime,
    },
    authoredOn: DateTime.now().toISO()!,
    meta: {
      tag: [
        { system: RCM_TAG_SYSTEM, code: 'rcm' },
        { system: OUTREACH_TASK_TAG_SYSTEM, code: action.trigger.event },
        { system: `${OUTREACH_TASK_TAG_SYSTEM}/action-id`, code: action.id },
      ],
    },
    input: buildTaskInput(action),
  } as unknown as Task;
}

/**
 * Encode the action details into Task.input so the executor has everything
 * it needs without re-reading the PlanDefinition.
 */
function buildTaskInput(action: DunningAction): Task['input'] {
  const inputs: Task['input'] = [
    {
      type: { text: 'action-id' },
      valueString: action.id,
    },
    {
      type: { text: 'trigger-event' },
      valueString: action.trigger.event,
    },
    {
      type: { text: 'action-type' },
      valueString: action.actionType,
    },
  ];

  if (action.actionType === 'send-notification' && action.sendNotificationConfig) {
    const cfg = action.sendNotificationConfig;
    inputs.push({
      type: { text: 'mediums' },
      valueString: cfg.mediums.join(','),
    });
    if (cfg.smsTemplate) {
      inputs.push({
        type: { text: 'sms-template' },
        valueString: cfg.smsTemplate,
      });
    }
    if (cfg.emailTemplate) {
      inputs.push({
        type: { text: 'email-template' },
        valueString: cfg.emailTemplate,
      });
    }
  }

  if (action.actionType === 'charge-card' && action.chargeCardConfig) {
    const cfg = action.chargeCardConfig;
    inputs.push({
      type: { text: 'charge-card-config' },
      valueString: JSON.stringify({
        retryAttempts: cfg.retryAttempts,
        retryIntervalDays: cfg.retryIntervalDays,
        onSuccess: cfg.onSuccess,
        onFailure: cfg.onFailure,
      }),
    });
  }

  if (action.actionType === 'refer-to-collections' && action.referToCollectionsConfig) {
    inputs.push({
      type: { text: 'refer-to-collections-config' },
      valueString: JSON.stringify(action.referToCollectionsConfig),
    });
  }

  return inputs;
}

function actionTypeDisplay(actionType: ActionType): string {
  const displays: Record<ActionType, string> = {
    'charge-card': 'Charge Credit Card on File',
    'send-notification': 'Send Notification',
    'refer-to-collections': 'Refer to Collections',
  };
  return displays[actionType];
}
