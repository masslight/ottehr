import { Coding } from 'fhir/r4b';

export interface CPTSearchRequestParams {
  search: string;
  type: 'cpt' | 'hcpcs' | 'both';
  radiologyOnly?: boolean;
}

export interface IcdSearchResponse {
  codes: Required<Pick<Coding, 'code' | 'display'>>[];
}
