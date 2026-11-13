import type { Patient } from 'fhir/r4b';

export const mockPatient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  active: true,
  name: [{ use: 'official', family: 'Lee', given: ['Morgan'] }],
  birthDate: '1990-06-15',
  gender: 'female',
  telecom: [
    { system: 'phone', value: '+12025550143' },
    { system: 'email', value: 'morgan.lee@example.com' },
  ],
  address: [{ line: ['48 Orchard Lane'], city: 'Brooklyn', state: 'NY', postalCode: '11201' }],
};
