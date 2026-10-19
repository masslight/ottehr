import { Patient } from 'fhir/r4b';

const toLegacyDataDob = (isoDate: string): string => {
  const [year, ...monthAndDay] = isoDate.split('-');
  return [...monthAndDay, year].join('-');
};

export const getLegacyDataUrl = (patient: Patient): string => {
  const birthDate = patient.birthDate ?? '';
  const params = new URLSearchParams({
    lastName: patient.name?.[0]?.family ?? '',
    firstName: patient.name?.[0]?.given?.[0] ?? '',
    dob: birthDate ? toLegacyDataDob(birthDate) : '',
  });
  return `/legacy-data?${params.toString()}`;
};
