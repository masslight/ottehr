export enum CancellationReasonOptionsInPerson {
  'Patient improved' = 'Patient improved',
  'Wait time too long' = 'Wait time too long',
  'Prefer another provider' = 'Prefer another provider',
  'Changing location' = 'Changing location',
  'Changing to telemedicine' = 'Changing to telemedicine',
  'Financial responsibility concern' = 'Financial responsibility concern',
  'Insurance issue' = 'Insurance issue',
  'Service never offered' = 'Service never offered',
  'Duplicate visit or account error' = 'Duplicate visit or account error',
}

export const CancellationReasonCodesInPerson: { [key in CancellationReasonOptionsInPerson]: string } = {
  'Patient improved': 'patient-improved',
  'Wait time too long': 'wait-time',
  'Prefer another provider': 'prefer-another-provider',
  'Changing location': 'changing-location',
  'Changing to telemedicine': 'changing-telemedicine',
  'Financial responsibility concern': 'financial-concern',
  'Insurance issue': 'insurance-issue',
  'Service never offered': 'service-not-offered',
  'Duplicate visit or account error': 'duplicate-visit-or-account-error',
};

export enum CancellationReasonOptionsTelemedEHR {
  'Patient did not answer after multiple attempts' = 'Patient did not answer after multiple attempts',
  'Wrong patient name on chart' = 'Wrong patient name on chart',
  'Technical issues connecting and/ or with video' = 'Technical issues connecting and/ or with video',
  'Other' = 'Other',
}
