import { ProcedureDTO } from './chart-data';

export interface ProcedureDetail extends ProcedureDTO {
  info?: string;
}

export interface ProcedureSuggestion {
  code: string;
  description: string;
  useWhen: string;
}
