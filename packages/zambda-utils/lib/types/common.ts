import { Secrets } from '../secrets';

export interface ZambdaInput {
  headers: any | null;
  body: string | null;
  secrets: Secrets | null;
  requestContext: any;
}
