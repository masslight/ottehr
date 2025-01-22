export enum CancellationReasonOptionsUrgentCare {
  'Patient improved' = 'Patient improved',
  'Wait time too long' = 'Wait time too long',
  'Financial responsibility concern' = 'Financial responsibility concern',
  'Duplicate visit or account error' = 'Duplicate visit or account error',
}

export const CancellationReasonCodesUrgentCare: { [key in CancellationReasonOptionsUrgentCare]: string } = {
  'Patient improved': 'patient-improved',
  'Wait time too long': 'wait-time',
  'Financial responsibility concern': 'financial-concern',
  'Duplicate visit or account error': 'duplicate-visit-or-account-error',
};
