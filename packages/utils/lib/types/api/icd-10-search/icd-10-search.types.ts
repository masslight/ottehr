export interface Icd10SearchRequestParams {
  search: string;
}

export interface Icd10SearchResponse {
  codes: Array<{
    code: string;
    display: string;
  }>;
}
