import { ZambdaTriggerType } from '../types';

export interface DeployZambdaInput {
  type: ZambdaTriggerType;
  event?: 'create' | 'update';
  criteria?: string;
  schedule?: {
    start?: string;
    end?: string;
    expression: string;
  };
  environments?: string[];
}
