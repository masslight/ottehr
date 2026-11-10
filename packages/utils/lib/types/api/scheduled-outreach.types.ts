import { PlanDefinition } from 'fhir/r4b';

export type TriggerEvent = 'date-of-visit' | 'invoice-issued' | 'invoice-due' | 'discharge-time' | 'patient-birthday';
export const INVOICE_OUTREACH_TRIGGER_EVENTS: readonly TriggerEvent[] = ['invoice-issued', 'invoice-due'];
export type NotificationMedium = 'sms' | 'email' | 'paper-mail';
export type ActionType = 'charge-card' | 'send-notification' | 'refer-to-collections' | 'log';
export type TimeUnit = 'days' | 'hours' | 'minutes';
export type TriggerDirection = 'after' | 'before';

export type OutreachStatementType = 'standard' | 'past-due' | 'final-notice';

export interface NotificationConfig {
  enabled: boolean;
  mediums: NotificationMedium[];
  smsTemplate: string;
  emailTemplate: string;
  statementType?: OutreachStatementType;
}

export interface ChargeCardConfig {
  onSuccess: NotificationConfig;
  onFailure: NotificationConfig;
  retryAttempts: number;
  retryIntervalDays: number;
}

export interface SendNotificationConfig {
  mediums: NotificationMedium[];
  smsTemplate: string;
  emailTemplate: string;
  statementType?: OutreachStatementType;
}

export interface ReferToCollectionsConfig {
  agency: string;
  minimumBalance: number;
  includePaymentHistory: boolean;
}

export type BirthdayAgeMode = 'at' | 'after';

export interface BirthdayConfig {
  /** 'at' = only on this exact age; 'after' = from this age onward (up to maxAge). */
  ageMode?: BirthdayAgeMode;
  /** The target age (required when ageMode is set). */
  age?: number;
  /** Upper bound when ageMode is 'after'. Defaults to 100 if not specified. */
  maxAge?: number;
}

export interface NotificationsTimeRestriction {
  enabled: boolean;
  windowStart: string; // HH:mm
  windowEnd: string; // HH:mm
  timezone: string;
}

export interface OutreachAction {
  id: string;
  enabled?: boolean;
  trigger: {
    event: TriggerEvent;
    daysAfter: number;
    timeUnit?: TimeUnit;
    direction?: TriggerDirection;
  };
  actionType: ActionType;
  chargeCardConfig?: ChargeCardConfig;
  sendNotificationConfig?: SendNotificationConfig;
  referToCollectionsConfig?: ReferToCollectionsConfig;
  logConfig?: Record<string, never>;
  birthdayConfig?: BirthdayConfig;
}

export interface OutreachConfigResponse {
  planDefinition: PlanDefinition;
  actions: OutreachAction[];
  notificationsTimeRestriction: NotificationsTimeRestriction;
}

export interface OutreachMediumResult {
  medium: NotificationMedium;
  success: boolean;
  error?: string;
  skippedReason?: string;
}
