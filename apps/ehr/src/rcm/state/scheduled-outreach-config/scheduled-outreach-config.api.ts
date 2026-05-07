import Oystehr from '@oystehr/sdk';
import { PlanDefinition } from 'fhir/r4b';
import { chooseJson } from 'utils';

const GET_OUTREACH_CONFIG_ZAMBDA_ID = 'get-scheduled-outreach-config';
const SAVE_OUTREACH_CONFIG_ZAMBDA_ID = 'save-scheduled-outreach-config';

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
export type ActionType = 'charge-card' | 'send-notification' | 'refer-to-collections';
export type TimeUnit = 'days' | 'hours' | 'minutes';
export type TriggerDirection = 'after' | 'before';

export interface NotificationConfigDTO {
  enabled: boolean;
  mediums: NotificationMedium[];
  smsTemplate: string;
  emailTemplate: string;
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
}

export interface ReferToCollectionsConfigDTO {
  agency: string;
  minimumBalance: number;
  includePaymentHistory: boolean;
}

export interface OutreachActionDTO {
  id: string;
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
