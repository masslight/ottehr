import { Secrets } from 'utils';

export interface ZambdaInput {
  headers: any | null;
  body: string | null;
  secrets: Secrets | null;
}
