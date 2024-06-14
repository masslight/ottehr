import { Coding } from 'fhir/r4';

export interface IcdSearchRequestParams {
  search: string;
}

export interface IcdSearchResponse {
  codes: Required<Pick<Coding, 'code' | 'display'>>[];
}
