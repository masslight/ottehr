import { Coding } from 'fhir/r4b';

export interface IcdSearchRequestParams {
  search: string;
  sabs: 'ICD10CM' | 'CPT';
  radiologyOnly?: boolean;
}

export interface IcdSearchResponse {
  codes: Required<Pick<Coding, 'code' | 'display'>>[];
}
