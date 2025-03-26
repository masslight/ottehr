import { Secrets } from 'utils/lib/secrets';

export interface ZambdaInput {
  headers: any | null;
  body: string | null;
  secrets: Secrets | null;
}
