export const icdCodes = [
  { code: 'J02.9', display: 'Acute pharyngitis, unspecified' },
  { code: 'J02.0', display: 'Streptococcal pharyngitis' },
  { code: 'J03.90', display: 'Acute tonsillitis, unspecified' },
];

// oystehr.terminology.searchIcd10 → GET {project}/icd10/search, answered with a bare { codes } body.
export const icdMocks = [{ url: '/icd10/search', response: { codes: icdCodes } }];
