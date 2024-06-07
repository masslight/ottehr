import { Patient } from 'fhir/r4';

export const getPatientName = (
  name?: Patient['name']
): {
  firstName: string | undefined;
  lastName: string | undefined;
  isFullName: boolean;
  firstLastName: string | undefined;
  lastFirstName: string | undefined;
} => {
  const firstName = name?.[0]?.given?.[0];
  const lastName = name?.[0]?.family;

  const isFullName = !!firstName && !!lastName;

  const firstLastName = isFullName ? `${firstName} ${lastName}` : undefined;
  const lastFirstName = isFullName ? `${lastName}, ${firstName}` : undefined;

  return {
    firstName,
    lastName,
    isFullName,
    firstLastName,
    lastFirstName,
  };
};
