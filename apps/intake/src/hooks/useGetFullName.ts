import { PatientBaseInfo } from 'utils/lib/types/common';

export const useGetFullName = (patient: PatientBaseInfo | undefined): string | undefined => {
  if (patient) {
    const { firstName, middleName, lastName } = patient;
    return `${firstName}${middleName ? ` ${middleName}` : ''} ${lastName}`;
  }
  return undefined;
};
