import { Patient } from 'fhir/r4b';

export const getPatientName = (
  name?: Patient['name']
): {
  firstName: string | undefined;
  lastName: string | undefined;
  middleName: string | undefined;
  preferredName: string | undefined;
  isFullName: boolean;
  firstLastName: string | undefined;
  lastFirstName: string | undefined;
  fullDisplayName: string | undefined;
} => {
  const firstName = name?.[0]?.given?.[0];
  const lastName = name?.[0]?.family;
  const middleName = name?.[0]?.given?.[1];
  const preferredName = name?.[1]?.given?.[0];

  const isFullName = Boolean(firstName && lastName);

  const firstLastName = isFullName ? `${firstName} ${lastName}` : undefined;
  const lastFirstName = isFullName ? `${lastName}, ${firstName}` : undefined;

  const lastFirstMiddle = [lastName, firstName, middleName].filter(Boolean).join(', ') || undefined;
  const legalBase = lastFirstMiddle ?? lastFirstName ?? lastName ?? firstName;

  const fullDisplayName =
    preferredName && legalBase && preferredName !== firstName
      ? `${legalBase} (${preferredName})`
      : legalBase ?? preferredName ?? undefined;

  return {
    firstName,
    lastName,
    middleName,
    preferredName,
    isFullName,
    firstLastName,
    lastFirstName,
    fullDisplayName,
  };
};
