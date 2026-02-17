export const VALUE_SET_OVERRIDES = {
  cancelReasonOptions: [
    { label: 'Patient improved', value: 'Patient improved', code: 'patient-improved' },
    { label: 'Wait time too long', value: 'Wait time too long', code: 'wait-time' },
    { label: 'Prefer another provider', value: 'Prefer another provider', code: 'prefer-another-provider' },
    { label: 'Changing location', value: 'Changing location', code: 'changing-location' },
    { label: 'Changing to telemedicine', value: 'Changing to telemedicine', code: 'changing-telemedicine' },
    { label: 'Financial responsibility concern', value: 'Financial responsibility concern', code: 'financial-concern' },
    { label: 'Insurance issue', value: 'Insurance issue', code: 'insurance-issue' },
    { label: 'Service never offered', value: 'Service never offered', code: 'service-not-offered' },
    {
      label: 'Duplicate visit or account error',
      value: 'Duplicate visit or account error',
      code: 'duplicate-visit-or-account-error',
    },
    {
      label: 'Provider deems acuity too high for clinic',
      value: 'Provider deems acuity too high for clinic',
      code: 'provider-deems-acuity-too-high-for-clinic',
    },
  ],
  reasonForVisitOptions: [
    { label: 'Illness', value: 'Illness' },
    { label: 'Injury Evaluation', value: 'Injury Evaluation' },
    { label: 'Concussion Evaluation', value: 'Concussion Evaluation' },
    { label: 'In-house STI (sexually transmitted disease)', value: 'In-house STI (sexually transmitted disease)' },
    { label: 'Mental Health Evaluation (Pediatrics only)', value: 'Mental Health Evaluation (Pediatrics only)' },
  ],
};
