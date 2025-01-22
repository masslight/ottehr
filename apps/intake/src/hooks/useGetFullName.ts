import { PatientBaseInfo } from 'utils';

export const useGetFullName = (patient: PatientBaseInfo | undefined): string | undefined => {
  if (patient) {
    const { firstName, middleName, lastName } = patient;
    return `${firstName}${middleName ? ` ${middleName}` : ''} ${lastName}`;
  }
  return undefined;
};
