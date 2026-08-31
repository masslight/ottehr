export type PatientAccountSection = 'insurance' | 'responsible' | 'workersComp';

export const getPatientAccountSectionOrder = (appointmentServiceCategory?: string): PatientAccountSection[] =>
  appointmentServiceCategory === 'workers-comp'
    ? ['workersComp', 'insurance', 'responsible']
    : ['insurance', 'responsible', 'workersComp'];
