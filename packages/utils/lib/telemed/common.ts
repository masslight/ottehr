export enum CancellationReasonOptionsTelemed {
  'Wait time too long' = 'Wait time too long',
  'Going to another urgent care company' = 'Going to another urgent care company',
  'Going to an emergency department' = 'Going to an emergency department',
  'Cost is too high' = 'Cost is too high',
  'Insurance issue' = 'Insurance issue',
  'Technical issue' = 'Technical issue',
  'Patient improved' = 'Patient improved',
  'Clicked accidentally' = 'Clicked accidentally',
  'Other' = 'Other',
}

export enum CancellationReasonOptionsProviderSideTelemed {
  'Patient did not answer after multiple attempts' = 'Patient did not answer after multiple attempts',
  'Wrong patient name on chart' = 'Wrong patient name on chart',
  'Technical issues connecting and/ or with video' = 'Technical issues connecting and/ or with video',
  'Other' = 'Other',
}

export const CancellationReasonCodesTelemed: {
  [key in CancellationReasonOptionsTelemed | CancellationReasonOptionsProviderSideTelemed]: string;
} = {
  'Wait time too long': 'wait-time',
  'Going to another urgent care company': 'another-uc',
  'Going to an emergency department': 'emergency-department',
  'Cost is too high': 'cost-too-high',
  'Insurance issue': 'insurance-issue',
  'Technical issue': 'technical-issue',
  'Patient improved': 'patient-improved',
  'Clicked accidentally': 'clicked-accidentally',
  Other: 'other',
  // for the provider reasons:
  'Patient did not answer after multiple attempts': 'patient-did-not-answer',
  'Wrong patient name on chart': 'wrong-patient-name',
  'Technical issues connecting and/ or with video': 'technical-issues-video',
};
