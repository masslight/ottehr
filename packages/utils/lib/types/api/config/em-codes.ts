import { CPTCodeOption } from '../../common';

export interface CreateEmCodeInput {
  code: string;
  display: string;
}

export interface UpdateEmCodeInput {
  code: string;
  display: string;
}

export interface DeleteEmCodeInput {
  code: string;
}

export interface EmCodeOutput {
  codes: CPTCodeOption[];
}
