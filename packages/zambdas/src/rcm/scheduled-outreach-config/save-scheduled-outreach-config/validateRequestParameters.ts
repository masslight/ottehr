import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';
import {
  ActionType,
  NotificationMedium,
  NotificationsTimeRestriction,
  OutreachAction,
  OutreachStatementType,
  TimeUnit,
  TriggerDirection,
  TriggerEvent,
} from '../helpers';

export interface SaveOutreachConfigInput {
  actions: OutreachAction[];
  notificationsTimeRestriction?: NotificationsTimeRestriction;
  secrets: Record<string, string>;
}

const VALID_ACTION_TYPES: ActionType[] = ['charge-card', 'send-notification', 'refer-to-collections', 'log'];
const VALID_TRIGGER_EVENTS: TriggerEvent[] = [
  'date-of-visit',
  'invoice-issued',
  'invoice-due',
  'discharge-time',
  'patient-birthday',
];
const VALID_MEDIUMS: NotificationMedium[] = ['sms', 'email', 'paper-mail'];
const VALID_STATEMENT_TYPES: OutreachStatementType[] = ['standard', 'past-due', 'final-notice'];
const VALID_TIME_UNITS: TimeUnit[] = ['days', 'hours', 'minutes'];
const VALID_DIRECTIONS: TriggerDirection[] = ['after', 'before'];

/** Events that only allow send-notification or log. */
const NOTIFICATION_ONLY_EVENTS: TriggerEvent[] = ['discharge-time', 'patient-birthday'];

function validateAction(action: unknown, index: number): OutreachAction {
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

  if (NOTIFICATION_ONLY_EVENTS.includes(triggerEvent) && actionType !== 'send-notification' && actionType !== 'log') {
    throw INVALID_INPUT_ERROR(
      `actions[${index}].actionType must be 'send-notification' or 'log' for trigger event '${triggerEvent}'`
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
    if (cfg.mediums.includes('paper-mail') && cfg.statementType != null) {
      if (!VALID_STATEMENT_TYPES.includes(cfg.statementType as OutreachStatementType)) {
        throw INVALID_INPUT_ERROR(
          `actions[${index}].sendNotificationConfig.statementType must be one of: ${VALID_STATEMENT_TYPES.join(', ')}`
        );
      }
    }
  }

  if (actionType === 'refer-to-collections') {
    if (!a.referToCollectionsConfig || typeof a.referToCollectionsConfig !== 'object') {
      throw MISSING_REQUIRED_PARAMETERS([`actions[${index}].referToCollectionsConfig`]);
    }
  }

  if (a.birthdayConfig !== undefined) {
    if (typeof a.birthdayConfig !== 'object' || a.birthdayConfig === null) {
      throw INVALID_INPUT_ERROR(`actions[${index}].birthdayConfig must be an object`);
    }
    const bc = a.birthdayConfig as Record<string, unknown>;
    if (bc.ageMode !== undefined && bc.ageMode !== 'at' && bc.ageMode !== 'after') {
      throw INVALID_INPUT_ERROR(`actions[${index}].birthdayConfig.ageMode must be 'at' or 'after'`);
    }
    if (bc.age !== undefined && (typeof bc.age !== 'number' || bc.age < 1 || bc.age > 150)) {
      throw INVALID_INPUT_ERROR(`actions[${index}].birthdayConfig.age must be a number between 1 and 150`);
    }
    if (bc.maxAge !== undefined && (typeof bc.maxAge !== 'number' || bc.maxAge < 1 || bc.maxAge > 150)) {
      throw INVALID_INPUT_ERROR(`actions[${index}].birthdayConfig.maxAge must be a number between 1 and 150`);
    }
  }

  return a as unknown as OutreachAction;
}

export function validateRequestParameters(input: ZambdaInput): SaveOutreachConfigInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsed = JSON.parse(input.body);
  const { actions, notificationsTimeRestriction } = parsed;

  if (!Array.isArray(actions)) {
    throw INVALID_INPUT_ERROR('actions must be an array');
  }

  const validatedActions = actions.map((action: unknown, index: number) => validateAction(action, index));

  let validatedNotificationsTimeRestriction: NotificationsTimeRestriction | undefined;
  if (notificationsTimeRestriction !== undefined) {
    if (typeof notificationsTimeRestriction !== 'object' || notificationsTimeRestriction === null) {
      throw INVALID_INPUT_ERROR('notificationsTimeRestriction must be an object');
    }
    const r = notificationsTimeRestriction as Record<string, unknown>;
    if (typeof r.enabled !== 'boolean') {
      throw INVALID_INPUT_ERROR('notificationsTimeRestriction.enabled must be a boolean');
    }
    if (typeof r.windowStart !== 'string' || !/^\d{2}:\d{2}$/.test(r.windowStart)) {
      throw INVALID_INPUT_ERROR('notificationsTimeRestriction.windowStart must be a time string (HH:mm)');
    }
    if (typeof r.windowEnd !== 'string' || !/^\d{2}:\d{2}$/.test(r.windowEnd)) {
      throw INVALID_INPUT_ERROR('notificationsTimeRestriction.windowEnd must be a time string (HH:mm)');
    }
    if (typeof r.timezone !== 'string' || r.timezone.trim().length === 0) {
      throw INVALID_INPUT_ERROR('notificationsTimeRestriction.timezone must be a non-empty string');
    }
    validatedNotificationsTimeRestriction = r as unknown as NotificationsTimeRestriction;
  }

  return {
    actions: validatedActions,
    notificationsTimeRestriction: validatedNotificationsTimeRestriction,
    secrets: input.secrets,
  };
}
