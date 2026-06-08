import Oystehr from '@oystehr/sdk';
import { PlanDefinition } from 'fhir/r4b';
import { chooseJson } from 'utils';

const GET_OUTREACH_CONFIG_ZAMBDA_ID = 'get-scheduled-outreach-config';
const SAVE_OUTREACH_CONFIG_ZAMBDA_ID = 'save-scheduled-outreach-config';
const LIST_OUTREACH_TASKS_ZAMBDA_ID = 'list-outreach-tasks';
const CANCEL_OUTREACH_TASK_ZAMBDA_ID = 'cancel-outreach-task';
const RETRY_OUTREACH_TASK_ZAMBDA_ID = 'retry-outreach-task';

export interface NotificationsTimeRestrictionDTO {
  enabled: boolean;
  windowStart: string;
  windowEnd: string;
  timezone: string;
}

export interface OutreachConfigResponse {
  planDefinition: PlanDefinition;
  actions: OutreachActionDTO[];
  notificationsTimeRestriction?: NotificationsTimeRestrictionDTO;
}

export type TriggerEvent = 'date-of-visit' | 'invoice-issued' | 'invoice-due' | 'discharge-time' | 'patient-birthday';
export type NotificationMedium = 'sms' | 'email' | 'paper-mail';
export type ActionType = 'charge-card' | 'send-notification' | 'refer-to-collections' | 'log';
export type TimeUnit = 'days' | 'hours' | 'minutes';
export type TriggerDirection = 'after' | 'before';

export type OutreachStatementType = 'standard' | 'past-due' | 'final-notice';

export interface NotificationConfigDTO {
  enabled: boolean;
  mediums: NotificationMedium[];
  smsTemplate: string;
  emailTemplate: string;
  statementType?: OutreachStatementType;
}

export interface ChargeCardConfigDTO {
  onSuccess: NotificationConfigDTO;
  onFailure: NotificationConfigDTO;
  retryAttempts: number;
  retryIntervalDays: number;
}

export interface SendNotificationConfigDTO {
  mediums: NotificationMedium[];
  smsTemplate: string;
  emailTemplate: string;
  statementType?: OutreachStatementType;
}

export interface ReferToCollectionsConfigDTO {
  agency: string;
  minimumBalance: number;
  includePaymentHistory: boolean;
}

export interface BirthdayConfigDTO {
  ageMode?: 'at' | 'after';
  age?: number;
  maxAge?: number;
}

export interface OutreachActionDTO {
  id: string;
  enabled?: boolean;
  trigger: {
    event: TriggerEvent;
    daysAfter: number;
    timeUnit?: TimeUnit;
    direction?: TriggerDirection;
  };
  actionType: ActionType;
  chargeCardConfig?: ChargeCardConfigDTO;
  sendNotificationConfig?: SendNotificationConfigDTO;
  referToCollectionsConfig?: ReferToCollectionsConfigDTO;
  logConfig?: Record<string, never>;
  birthdayConfig?: BirthdayConfigDTO;
}

export interface SaveOutreachConfigInput {
  actions: OutreachActionDTO[];
  notificationsTimeRestriction?: NotificationsTimeRestrictionDTO;
}

export const getOutreachConfig = async (oystehr: Oystehr): Promise<OutreachConfigResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: GET_OUTREACH_CONFIG_ZAMBDA_ID,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const saveOutreachConfig = async (
  oystehr: Oystehr,
  parameters: SaveOutreachConfigInput
): Promise<OutreachConfigResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: SAVE_OUTREACH_CONFIG_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

// ── Outreach Tasks (report) ─────────────────────────────────────────────────

export interface OutreachTaskSummary {
  id: string;
  status: string;
  actionType: string;
  triggerEvent: string;
  actionId: string;
  patientId: string;
  patientName: string;
  patientFriendlyId?: string;
  appointmentId?: string;
  visitDate?: string;
  focusReference: string;
  dueDateTime: string;
  authoredOn: string;
  completedDateTime?: string;
  description: string;
  mediums?: string;
  errorMessage?: string;
  cancellationReason?: string;
  chargeResult?: { success: boolean; transactionId?: string; error?: string; amountCents?: number };
  notificationResults?: { medium: string; success: boolean; error?: string }[];
  executionResult?: { medium: string; success: boolean; error?: string }[];
  retryInfo?: {
    attemptCount: number;
    maxAttempts: number;
    nextRetryDate?: string;
  };
}

export interface ListOutreachTasksResponse {
  tasks: OutreachTaskSummary[];
  totalCount: number;
  pageSize: number;
  offset: number;
}

export interface ListOutreachTasksInput {
  status?: string;
  actionType?: string;
  medium?: string;
  triggerEvent?: string;
  patientSearch?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  createdFrom?: string;
  createdTo?: string;
  pageSize?: number;
  offset?: number;
}

export const listOutreachTasks = async (
  oystehr: Oystehr,
  parameters?: ListOutreachTasksInput
): Promise<ListOutreachTasksResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: LIST_OUTREACH_TASKS_ZAMBDA_ID,
      ...(parameters || {}),
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export interface CancelOutreachTaskInput {
  taskId: string;
}

export const cancelOutreachTask = async (
  oystehr: Oystehr,
  parameters: CancelOutreachTaskInput
): Promise<{ success: boolean; taskId: string }> => {
  try {
    const response = await oystehr.zambda.execute({
      id: CANCEL_OUTREACH_TASK_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export interface RetryOutreachTaskInput {
  taskId: string;
}

export const retryOutreachTask = async (
  oystehr: Oystehr,
  parameters: RetryOutreachTaskInput
): Promise<{ success: boolean; taskId: string }> => {
  try {
    const response = await oystehr.zambda.execute({
      id: RETRY_OUTREACH_TASK_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};
