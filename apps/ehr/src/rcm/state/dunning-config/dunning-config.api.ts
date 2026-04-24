import Oystehr from '@oystehr/sdk';
import { PlanDefinition } from 'fhir/r4b';
import { chooseJson } from 'utils';

const GET_DUNNING_CONFIG_ZAMBDA_ID = 'get-dunning-config';
const SAVE_DUNNING_CONFIG_ZAMBDA_ID = 'save-dunning-config';

export interface SmsTimeRestrictionDTO {
  enabled: boolean;
  windowStart: string;
  windowEnd: string;
  timezone: string;
}

export interface DunningConfigResponse {
  planDefinition: PlanDefinition;
  actions: DunningActionDTO[];
  smsTimeRestriction?: SmsTimeRestrictionDTO;
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

export interface DunningActionDTO {
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

export interface SaveDunningConfigInput {
  actions: DunningActionDTO[];
  smsTimeRestriction?: SmsTimeRestrictionDTO;
}

export const getDunningConfig = async (oystehr: Oystehr): Promise<DunningConfigResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: GET_DUNNING_CONFIG_ZAMBDA_ID,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const saveDunningConfig = async (
  oystehr: Oystehr,
  parameters: SaveDunningConfigInput
): Promise<DunningConfigResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: SAVE_DUNNING_CONFIG_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};
