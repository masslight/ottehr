import { Coding } from 'fhir/r4b';

export interface CPTSearchRequestParams {
  search: string;
  radiologyOnly?: boolean;
}

export interface IcdSearchResponse {
  codes: Required<Pick<Coding, 'code' | 'display'>>[];
}
