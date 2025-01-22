import { SubscriptionZambdaDetails, ZambdaTriggerType } from '../types';

export interface DeployZambdaInput {
  type: ZambdaTriggerType;
  event?: 'create' | 'update';
  criteria?: string;
  subscriptionDetails?: SubscriptionZambdaDetails[];
  schedule?: {
    start?: string;
    end?: string;
    expression: string;
  };
  environments?: string[];
}
