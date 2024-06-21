import { Secrets } from 'ehr-utils';

export interface ZambdaInput {
  headers: any | null;
  body: string | null;
  secrets: Secrets | null;
}

export interface ZambdaFunctionInput<TInputParams> {
  body: TInputParams;
  secrets: Secrets | null;
}
export interface ZambdaFunctionResponse<TResponse> {
  error?: unknown;
  response?: TResponse;
}
// todo: dedupe
