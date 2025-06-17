import { Secrets } from 'utils/src/secrets';

export interface ZambdaInput {
  headers: any | null;
  body: string | null;
  secrets: Secrets | null;
}
