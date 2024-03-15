export enum CancellationReasonOptions {
  'Patient improved' = 'Patient improved',
  'Wait time too long' = 'Wait time too long',
  'Prefer another urgent care provider' = 'Prefer another urgent care provider',
  'Financial responsibility concern' = 'Financial responsibility concern',
  'Insurance issue' = 'Insurance issue',
  'Duplicate visit or account error' = 'Duplicate visit or account error',
}

export const CancellationReasonCodes = {
  'Patient improved': 'patient-improved',
  'Wait time too long': 'wait-time',
  'Prefer another urgent care provider': 'prefer-another-provider',
  'Financial responsibility concern': 'financial-concern',
  'Insurance issue': 'insurance-issue',
  'Duplicate visit or account error': 'duplicate-visit-or-account-error',
};
