import { ProcedureDTO } from './chart-data';

export interface ProcedureDetail extends ProcedureDTO {
  info?: string;
}

export interface ProcedureSuggestion {
  code: string;
  description: string;
  useWhen: string;
}

export const CPT_SYSTEM = 'http://www.ama-assn.org/go/cpt';
export const HCPCS_SYSTEM = 'https://www.cms.gov/medicare/hcpcs';

export type ProcedureSystem = typeof CPT_SYSTEM | typeof HCPCS_SYSTEM;
