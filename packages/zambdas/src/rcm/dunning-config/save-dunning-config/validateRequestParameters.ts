import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';
import {
  ActionType,
  DunningAction,
  NotificationMedium,
  SmsTimeRestriction,
  TimeUnit,
  TriggerDirection,
  TriggerEvent,
} from '../helpers';

export interface SaveDunningConfigInput {
  actions: DunningAction[];
  smsTimeRestriction?: SmsTimeRestriction;
  secrets: Record<string, string>;
}

const VALID_ACTION_TYPES: ActionType[] = ['charge-card', 'send-notification', 'refer-to-collections'];
const VALID_TRIGGER_EVENTS: TriggerEvent[] = [
  'date-of-visit',
  'invoice-issued',
  'invoice-due',
  'discharge-time',
  'patient-birthday',
];
const VALID_MEDIUMS: NotificationMedium[] = ['sms', 'email', 'paper-mail'];
const VALID_TIME_UNITS: TimeUnit[] = ['days', 'hours', 'minutes'];
const VALID_DIRECTIONS: TriggerDirection[] = ['after', 'before'];

/** Events that only allow send-notification. */
const NOTIFICATION_ONLY_EVENTS: TriggerEvent[] = ['discharge-time', 'patient-birthday'];

function validateAction(action: unknown, index: number): DunningAction {
  if (!action || typeof action !== 'object') {
    throw INVALID_INPUT_ERROR(`actions[${index}] must be an object`);
  }

  const a = action as Record<string, unknown>;

  if (typeof a.id !== 'string' || a.id.trim().length === 0) {
    throw INVALID_INPUT_ERROR(`actions[${index}].id must be a non-empty string`);
  }

  if (!a.trigger || typeof a.trigger !== 'object') {
    throw MISSING_REQUIRED_PARAMETERS([`actions[${index}].trigger`]);
  }

  const trigger = a.trigger as Record<string, unknown>;
  if (!VALID_TRIGGER_EVENTS.includes(trigger.event as TriggerEvent)) {
    throw INVALID_INPUT_ERROR(`actions[${index}].trigger.event must be one of: ${VALID_TRIGGER_EVENTS.join(', ')}`);
  }

  if (typeof trigger.daysAfter !== 'number' || trigger.daysAfter < 0) {
    throw INVALID_INPUT_ERROR(`actions[${index}].trigger.daysAfter must be a non-negative number`);
  }

  if (trigger.timeUnit !== undefined && !VALID_TIME_UNITS.includes(trigger.timeUnit as TimeUnit)) {
    throw INVALID_INPUT_ERROR(`actions[${index}].trigger.timeUnit must be one of: ${VALID_TIME_UNITS.join(', ')}`);
  }

  if (trigger.direction !== undefined && !VALID_DIRECTIONS.includes(trigger.direction as TriggerDirection)) {
    throw INVALID_INPUT_ERROR(`actions[${index}].trigger.direction must be one of: ${VALID_DIRECTIONS.join(', ')}`);
  }

  if (!VALID_ACTION_TYPES.includes(a.actionType as ActionType)) {
    throw INVALID_INPUT_ERROR(`actions[${index}].actionType must be one of: ${VALID_ACTION_TYPES.join(', ')}`);
  }

  const triggerEvent = trigger.event as TriggerEvent;
  const actionType = a.actionType as ActionType;

  if (NOTIFICATION_ONLY_EVENTS.includes(triggerEvent) && actionType !== 'send-notification') {
    throw INVALID_INPUT_ERROR(
      `actions[${index}].actionType must be 'send-notification' for trigger event '${triggerEvent}'`
    );
  }

  if (actionType === 'charge-card') {
    if (!a.chargeCardConfig || typeof a.chargeCardConfig !== 'object') {
      throw MISSING_REQUIRED_PARAMETERS([`actions[${index}].chargeCardConfig`]);
    }
    const cfg = a.chargeCardConfig as Record<string, unknown>;
    if (typeof cfg.retryAttempts !== 'number' || cfg.retryAttempts < 0) {
      throw INVALID_INPUT_ERROR(`actions[${index}].chargeCardConfig.retryAttempts must be a non-negative number`);
    }
    if (typeof cfg.retryIntervalDays !== 'number' || cfg.retryIntervalDays < 1) {
      throw INVALID_INPUT_ERROR(`actions[${index}].chargeCardConfig.retryIntervalDays must be a positive number`);
    }
  }

  if (actionType === 'send-notification') {
    if (!a.sendNotificationConfig || typeof a.sendNotificationConfig !== 'object') {
      throw MISSING_REQUIRED_PARAMETERS([`actions[${index}].sendNotificationConfig`]);
    }
    const cfg = a.sendNotificationConfig as Record<string, unknown>;
    if (!Array.isArray(cfg.mediums) || cfg.mediums.length === 0) {
      throw INVALID_INPUT_ERROR(`actions[${index}].sendNotificationConfig.mediums must be a non-empty array`);
    }
    for (const m of cfg.mediums) {
      if (!VALID_MEDIUMS.includes(m as NotificationMedium)) {
        throw INVALID_INPUT_ERROR(`actions[${index}].sendNotificationConfig.mediums contains invalid value: ${m}`);
      }
    }
  }

  if (actionType === 'refer-to-collections') {
    if (!a.referToCollectionsConfig || typeof a.referToCollectionsConfig !== 'object') {
      throw MISSING_REQUIRED_PARAMETERS([`actions[${index}].referToCollectionsConfig`]);
    }
  }

  return a as unknown as DunningAction;
}

export function validateRequestParameters(input: ZambdaInput): SaveDunningConfigInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsed = JSON.parse(input.body);
  const { actions, smsTimeRestriction } = parsed;

  if (!Array.isArray(actions)) {
    throw INVALID_INPUT_ERROR('actions must be an array');
  }

  const validatedActions = actions.map((action: unknown, index: number) => validateAction(action, index));

  let validatedSmsTimeRestriction: SmsTimeRestriction | undefined;
  if (smsTimeRestriction !== undefined) {
    if (typeof smsTimeRestriction !== 'object' || smsTimeRestriction === null) {
      throw INVALID_INPUT_ERROR('smsTimeRestriction must be an object');
    }
    const r = smsTimeRestriction as Record<string, unknown>;
    if (typeof r.enabled !== 'boolean') {
      throw INVALID_INPUT_ERROR('smsTimeRestriction.enabled must be a boolean');
    }
    if (typeof r.windowStart !== 'string' || !/^\d{2}:\d{2}$/.test(r.windowStart)) {
      throw INVALID_INPUT_ERROR('smsTimeRestriction.windowStart must be a time string (HH:mm)');
    }
    if (typeof r.windowEnd !== 'string' || !/^\d{2}:\d{2}$/.test(r.windowEnd)) {
      throw INVALID_INPUT_ERROR('smsTimeRestriction.windowEnd must be a time string (HH:mm)');
    }
    if (typeof r.timezone !== 'string' || r.timezone.trim().length === 0) {
      throw INVALID_INPUT_ERROR('smsTimeRestriction.timezone must be a non-empty string');
    }
    validatedSmsTimeRestriction = r as unknown as SmsTimeRestriction;
  }

  return {
    actions: validatedActions,
    smsTimeRestriction: validatedSmsTimeRestriction,
    secrets: input.secrets,
  };
}
