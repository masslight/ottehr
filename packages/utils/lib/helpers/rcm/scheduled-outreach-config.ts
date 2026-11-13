import {
  ActionType,
  NotificationConfig,
  NotificationMedium,
  OutreachAction,
  OutreachStatementType,
  TimeUnit,
  TriggerDirection,
  TriggerEvent,
} from '../../types/api/scheduled-outreach.types';

export const TRIGGER_EVENT_LABELS: Record<TriggerEvent, string> = {
  'discharge-time': 'Discharge Time',
  'date-of-visit': 'Visit Date',
  'invoice-issued': 'Invoice Issue Date',
  'invoice-due': 'Invoice Due Date',
  'patient-birthday': 'Patient Birthday',
};

/** Which action types are allowed for each trigger event. */
export const ALLOWED_ACTIONS: Record<TriggerEvent, ActionType[]> = {
  'date-of-visit': ['charge-card', 'send-notification', 'refer-to-collections', 'log'],
  'invoice-issued': ['charge-card', 'send-notification', 'refer-to-collections', 'log'],
  'invoice-due': ['charge-card', 'send-notification', 'refer-to-collections', 'log'],
  'discharge-time': ['send-notification', 'log'],
  'patient-birthday': ['send-notification', 'log'],
};

/** Which time units are available for each trigger event. */
export const ALLOWED_TIME_UNITS: Record<TriggerEvent, TimeUnit[]> = {
  'date-of-visit': ['days'],
  'invoice-issued': ['days'],
  'invoice-due': ['days'],
  'discharge-time': ['days', 'hours', 'minutes'],
  'patient-birthday': ['days'],
};

/** Whether the trigger supports before/after direction. */
export const SUPPORTS_DIRECTION: Record<TriggerEvent, boolean> = {
  'date-of-visit': false,
  'invoice-issued': false,
  'invoice-due': false,
  'discharge-time': false,
  'patient-birthday': true,
};

export const TIME_UNIT_LABELS: Record<TimeUnit, string> = {
  days: 'Days',
  hours: 'Hours',
  minutes: 'Minutes',
};

export const DIRECTION_LABELS: Record<TriggerDirection, string> = {
  after: 'After',
  before: 'Before',
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  'charge-card': 'Charge Credit Card on File',
  'send-notification': 'Send Notification',
  'refer-to-collections': 'Refer to Collections',
  log: 'Log',
};

export const OUTREACH_TASK_STATUS_LABELS: Record<string, string> = {
  draft: 'Pending',
  requested: 'Requested',
  'in-progress': 'In Progress',
  completed: 'Completed',
  'on-hold': 'On Hold',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const MEDIUM_LABELS: Record<NotificationMedium, string> = {
  sms: 'SMS',
  email: 'Email',
  'paper-mail': 'Mail Statement',
};

export const STATEMENT_TYPE_LABELS: Record<OutreachStatementType, string> = {
  standard: 'Standard',
  'past-due': 'Past Due',
  'final-notice': 'Final Notice',
};

export const OUTREACH_TIMEZONE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'America/New_York', label: 'Eastern (America/New_York)' },
  { value: 'America/Chicago', label: 'Central (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain (America/Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific (America/Los_Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (America/Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Pacific/Honolulu)' },
  { value: 'UTC', label: 'UTC' },
];

export const DEFAULT_SMS_TEMPLATE =
  'Hello {{patient-full-name}}, thank you for visiting {{clinic}} at {{location}} on {{visit-date}} and entrusting us with your care. You can view your information in the Patient Portal: {{patient-portal-link}}';
export const DEFAULT_EMAIL_TEMPLATE =
  'Hello {{patient-full-name}},\n\nThank you for visiting {{clinic}} at {{location}} on {{visit-date}} and entrusting us with your care.\n\nYou can view your information in the [Patient Portal]({{patient-portal-link}}).\n\nThank you,\n{{clinic}}';

export function defaultNotificationConfig(): NotificationConfig {
  return {
    enabled: true,
    mediums: ['email'],
    smsTemplate: DEFAULT_SMS_TEMPLATE,
    emailTemplate: DEFAULT_EMAIL_TEMPLATE,
  };
}

export function buildDefaultConfig(actionType: ActionType): Partial<OutreachAction> {
  switch (actionType) {
    case 'charge-card':
      return {
        chargeCardConfig: {
          onSuccess: defaultNotificationConfig(),
          onFailure: defaultNotificationConfig(),
          retryAttempts: 0,
          retryIntervalDays: 0,
        },
      };
    case 'send-notification':
      return {
        sendNotificationConfig: {
          mediums: ['email'],
          smsTemplate: DEFAULT_SMS_TEMPLATE,
          emailTemplate: DEFAULT_EMAIL_TEMPLATE,
        },
      };
    case 'refer-to-collections':
      return {
        referToCollectionsConfig: {
          agency: '',
          minimumBalance: 0,
          includePaymentHistory: false,
        },
      };
    case 'log':
      return {};
  }
}
