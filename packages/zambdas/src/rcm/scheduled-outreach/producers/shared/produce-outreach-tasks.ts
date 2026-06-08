import Oystehr from '@oystehr/sdk';
import { BatchInputRequest } from '@oystehr/sdk';
import { Patient, PlanDefinition, Reference, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { phone } from 'phone';
import {
  FEATURE_FLAGS_CONFIG,
  getPatientContactEmail,
  getPhoneNumberForIndividual,
  isEmailValid,
  PRIVATE_EXTENSION_BASE_URL,
} from 'utils';
import { getPatchBinary } from '../../../../shared/helpers';
import {
  ActionType,
  getOrCreateOutreachConfig,
  OutreachAction,
  parsePlanDefinitionToActions,
  TriggerEvent,
} from '../../../scheduled-outreach-config/helpers';

const RCM_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/rcm`;
export const OUTREACH_TASK_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/outreach-task`;
const OUTREACH_ACTION_TYPE_SYSTEM = 'https://ottehr.com/CodeSystem/outreach-action-type';

export interface ProduceOutreachTasksParams {
  triggerEvent: TriggerEvent;
  patient: Reference;
  focus: Reference; // Invoice, Encounter, etc.
  appointment?: Reference; // Appointment linked to the triggering event
  eventTimestamp: string; // ISO datetime the event occurred/is scheduled
  oystehr: Oystehr;
  /** Optional filter to only produce tasks for specific actions. If omitted, all matching actions are produced. */
  actionFilter?: (action: OutreachAction) => boolean;
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
  const { triggerEvent, patient, focus, appointment, eventTimestamp, oystehr, actionFilter } = params;

  if (!FEATURE_FLAGS_CONFIG.automatedPatientOutreachEnabled) {
    console.log('produceOutreachTasks: automatedPatientOutreachEnabled is disabled, skipping');
    return { created: [], skipped: [] };
  }

  const planDefinition = await getOrCreateOutreachConfig(oystehr);
  const actions = parsePlanDefinitionToActions(planDefinition);

  let matchingActions = actions.filter((a) => a.trigger.event === triggerEvent);
  if (actionFilter) {
    matchingActions = matchingActions.filter(actionFilter);
  }

  // Skip actions that have been explicitly disabled
  matchingActions = matchingActions.filter((a) => a.enabled !== false);

  if (matchingActions.length === 0) {
    console.log(`No outreach actions configured for trigger event "${triggerEvent}"`);
    return { created: [], skipped: [] };
  }

  // Check for existing tasks to avoid duplicates
  const existingTasks = await findExistingOutreachTasks(oystehr, focus, triggerEvent);
  const existingActionIds = new Set(existingTasks.map((t) => extractActionIdFromTask(t)).filter(Boolean));

  // Pre-fetch patient for contact validation on notification actions
  const hasNotificationActions = matchingActions.some((a) => a.actionType === 'send-notification');
  let patientResource: Patient | undefined;
  let hasValidPhone = false;
  let hasValidEmail = false;

  if (hasNotificationActions) {
    const patientId = patient.reference?.replace('Patient/', '');
    if (patientId) {
      try {
        patientResource = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });
        const rawPhone = getPhoneNumberForIndividual(patientResource);
        hasValidPhone = !!rawPhone && phone(rawPhone, { country: 'USA' }).isValid;
        const rawEmail = getPatientContactEmail(patientResource);
        hasValidEmail = isEmailValid(rawEmail);
        console.log(
          `produceOutreachTasks: Patient ${patientId} contact validation — phone: ${
            hasValidPhone ? 'valid' : rawPhone ? 'invalid' : 'missing'
          }, email: ${hasValidEmail ? 'valid' : rawEmail ? 'invalid' : 'missing'}`
        );
      } catch (err) {
        console.error(`produceOutreachTasks: Failed to fetch Patient/${patientId} for contact validation:`, err);
      }
    }
  }

  const result: OutreachTaskResult = { created: [], skipped: [] };

  for (const action of matchingActions) {
    if (existingActionIds.has(action.id)) {
      result.skipped.push({ actionId: action.id, reason: 'Task already exists' });
      continue;
    }

    // Item 10: refer-to-collections integration is not yet implemented — skip at producer level
    if (action.actionType === 'refer-to-collections') {
      result.skipped.push({ actionId: action.id, reason: 'refer-to-collections is not yet implemented' });
      continue;
    }

    // Item 9: skip notification tasks whose only medium is paper-mail when the feature is disabled
    if (action.actionType === 'send-notification' && action.sendNotificationConfig) {
      const mediums = action.sendNotificationConfig.mediums;
      if (mediums.every((m) => m === 'paper-mail') && !FEATURE_FLAGS_CONFIG.mailingPaperStatementsEnabled) {
        result.skipped.push({ actionId: action.id, reason: 'Paper mail feature is disabled' });
        continue;
      }
    }

    // Cancel notification tasks when all electronic notification mediums have invalid/missing contacts
    if (action.actionType === 'send-notification' && action.sendNotificationConfig) {
      const mediums = action.sendNotificationConfig.mediums;
      const electronicMediums = mediums.filter((m) => m !== 'paper-mail');
      if (electronicMediums.length > 0) {
        const allElectronicInvalid = electronicMediums.every((m) => {
          if (m === 'sms') return !hasValidPhone;
          if (m === 'email') return !hasValidEmail;
          return false;
        });
        // Only cancel if there are no valid electronic channels AND no paper-mail fallback
        const hasPaperMail = mediums.includes('paper-mail') && FEATURE_FLAGS_CONFIG.mailingPaperStatementsEnabled;
        if (allElectronicInvalid && !hasPaperMail) {
          const reasons = electronicMediums
            .map((m) => {
              if (m === 'sms') return hasValidPhone ? '' : 'no valid phone number';
              if (m === 'email') return hasValidEmail ? '' : 'no valid email address';
              return '';
            })
            .filter(Boolean);
          const cancelReason = `No valid contact methods: ${reasons.join(', ')}`;
          console.log(`produceOutreachTasks: Creating cancelled task for action ${action.id} — ${cancelReason}`);

          const dueDateTime = calculateDueDateTime(eventTimestamp, action);
          const taskDraft = buildOutreachTask(action, planDefinition, patient, focus, dueDateTime, appointment);
          const cancelledTask = {
            ...taskDraft,
            status: 'cancelled' as const,
            statusReason: { text: cancelReason },
          };
          const created = await oystehr.fhir.create<Task>(cancelledTask as unknown as Task);
          result.created.push(created);
          continue;
        }
      }
    }

    const dueDateTime = calculateDueDateTime(eventTimestamp, action);
    const task = buildOutreachTask(action, planDefinition, patient, focus, dueDateTime, appointment);
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
function calculateDueDateTime(eventTimestamp: string, action: OutreachAction): string {
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
 * Includes completed tasks in the check to prevent re-triggering actions that have already been executed.
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
      { name: 'status', value: 'draft,requested,in-progress,completed' },
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
  action: OutreachAction,
  planDefinition: PlanDefinition,
  patient: Reference,
  focus: Reference,
  dueDateTime: string,
  appointment?: Reference
): Omit<Task, 'id'> {
  const basedOn: Reference[] = [{ reference: `PlanDefinition/${planDefinition.id}` }];
  if (appointment?.reference) {
    basedOn.push(appointment);
  }

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
    basedOn,
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
export function buildTaskInput(action: OutreachAction): Task['input'] {
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
    if (cfg.statementType) {
      inputs.push({
        type: { text: 'statement-type' },
        valueString: cfg.statementType,
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
    log: 'Log',
  };
  return displays[actionType];
}

/**
 * Compute the signed offset in minutes for an action trigger.
 */
function triggerOffsetMinutes(action: OutreachAction): number {
  const timeUnit = action.trigger.timeUnit || 'days';
  const direction = action.trigger.direction || 'after';
  const offset = action.trigger.daysAfter;
  const multiplier = timeUnit === 'days' ? 1440 : timeUnit === 'hours' ? 60 : 1;
  return (direction === 'before' ? -offset : offset) * multiplier;
}

/**
 * After saving an updated outreach configuration, reconcile existing draft tasks:
 *  - Cancel draft tasks whose action ID was removed from the config.
 *  - Update draft tasks whose action config changed (timing, templates, etc.).
 *
 * Only tasks in 'draft' status are affected; requested/in-progress/completed tasks
 * are left untouched.
 *
 * Returns batch request entries to be included in a FHIR transaction alongside
 * the PlanDefinition update for atomicity.
 */
export async function reconcileDraftTasksWithConfig(
  oystehr: Oystehr,
  oldActions: OutreachAction[],
  newActions: OutreachAction[]
): Promise<{ requests: BatchInputRequest<Task>[]; cancelled: number; updated: number }> {
  const newActionMap = new Map(newActions.map((a) => [a.id, a]));
  const oldActionMap = new Map(oldActions.map((a) => [a.id, a]));

  // Identify removed and potentially changed action IDs
  const removedIds = oldActions.filter((a) => !newActionMap.has(a.id)).map((a) => a.id);
  const keptIds = oldActions.filter((a) => newActionMap.has(a.id)).map((a) => a.id);

  const requests: BatchInputRequest<Task>[] = [];
  let cancelled = 0;
  let updated = 0;

  // ── Cancel tasks for removed actions ────────────────────────────────────
  if (removedIds.length > 0) {
    const draftTasks = await searchDraftTasksByActionIds(oystehr, removedIds);
    for (const task of draftTasks) {
      if (!task.id) continue;
      requests.push(
        getPatchBinary({
          resourceId: task.id,
          resourceType: 'Task',
          patchOperations: [{ op: 'replace', path: '/status', value: 'cancelled' }],
        })
      );
      cancelled++;
    }
    console.log(`reconcileDraftTasks: will cancel ${cancelled} draft tasks for ${removedIds.length} removed action(s)`);
  }

  // ── Update tasks for modified actions ───────────────────────────────────
  if (keptIds.length > 0) {
    const draftTasks = await searchDraftTasksByActionIds(oystehr, keptIds);
    for (const task of draftTasks) {
      if (!task.id) continue;
      const actionId = task.meta?.tag?.find((t) => t.system === `${OUTREACH_TASK_TAG_SYSTEM}/action-id`)?.code;
      if (!actionId) continue;

      const oldAction = oldActionMap.get(actionId);
      const newAction = newActionMap.get(actionId);
      if (!oldAction || !newAction) continue;

      // Build patches
      const patchOps: { op: 'replace' | 'add'; path: string; value: unknown }[] = [];

      // Timing change: shift executionPeriod.start by the offset delta
      const oldOffsetMin = triggerOffsetMinutes(oldAction);
      const newOffsetMin = triggerOffsetMinutes(newAction);
      if (oldOffsetMin !== newOffsetMin && task.executionPeriod?.start) {
        const deltaMin = newOffsetMin - oldOffsetMin;
        const newStart = DateTime.fromISO(task.executionPeriod.start).plus({ minutes: deltaMin }).toISO()!;
        patchOps.push({ op: 'replace', path: '/executionPeriod/start', value: newStart });
      }

      // Config change: rebuild input
      const newInput = buildTaskInput(newAction);
      const oldInputJson = JSON.stringify(task.input);
      const newInputJson = JSON.stringify(newInput);
      if (oldInputJson !== newInputJson) {
        patchOps.push({ op: 'replace', path: '/input', value: newInput });
      }

      // Action type or trigger event change: update code, description, and meta tags
      if (oldAction.actionType !== newAction.actionType) {
        patchOps.push({
          op: 'replace',
          path: '/code',
          value: {
            coding: [
              {
                system: OUTREACH_ACTION_TYPE_SYSTEM,
                code: newAction.actionType,
                display: actionTypeDisplay(newAction.actionType),
              },
            ],
          },
        });
      }

      if (oldAction.actionType !== newAction.actionType || oldAction.trigger.event !== newAction.trigger.event) {
        patchOps.push({
          op: 'replace',
          path: '/description',
          value: `Outreach: ${actionTypeDisplay(newAction.actionType)} triggered by ${newAction.trigger.event}`,
        });
      }

      if (oldAction.trigger.event !== newAction.trigger.event) {
        const newTags = [
          { system: `${PRIVATE_EXTENSION_BASE_URL}/rcm`, code: 'rcm' },
          { system: OUTREACH_TASK_TAG_SYSTEM, code: newAction.trigger.event },
          { system: `${OUTREACH_TASK_TAG_SYSTEM}/action-id`, code: newAction.id },
        ];
        patchOps.push({ op: 'replace', path: '/meta/tag', value: newTags });
      }

      if (patchOps.length > 0) {
        requests.push(
          getPatchBinary({
            resourceId: task.id,
            resourceType: 'Task',
            patchOperations: patchOps,
          })
        );
        updated++;
      }
    }
    console.log(`reconcileDraftTasks: will update ${updated} draft tasks for modified actions`);
  }

  return { requests, cancelled, updated };
}

/**
 * Search for draft outreach tasks that match any of the given action IDs.
 * Searches each action ID individually since _tag with multiple system|code
 * pairs in a single param is unreliable.
 */
async function searchDraftTasksByActionIds(oystehr: Oystehr, actionIds: string[]): Promise<Task[]> {
  const allTasks: Task[] = [];
  const seenIds = new Set<string>();
  for (const actionId of actionIds) {
    const bundle = await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        { name: '_tag', value: `${OUTREACH_TASK_TAG_SYSTEM}/action-id|${actionId}` },
        { name: 'status', value: 'draft' },
      ],
    });
    for (const task of bundle.unbundle()) {
      if (task.id && !seenIds.has(task.id)) {
        seenIds.add(task.id);
        allTasks.push(task);
      }
    }
  }
  return allTasks;
}
