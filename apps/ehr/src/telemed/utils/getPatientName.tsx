import { Patient } from 'fhir/r4b';

export const getPatientName = (
  name?: Patient['name']
): {
  firstName: string | undefined;
  lastName: string | undefined;
  middleName: string | undefined;
  // suffix: string | undefined;
  isFullName: boolean;
  firstLastName: string | undefined;
  lastFirstName: string | undefined;
  firstMiddleLastName: string | undefined;
  lastFirstMiddleName: string | undefined;
} => {
  const firstName = name?.[0]?.given?.[0];
  const lastName = name?.[0]?.family;
  const middleName = name?.[0]?.given?.[1];
  // const suffix = name?.[0]?.suffix?.[0];

  // const isFullName = !!firstName && !!lastName && !!suffix;

  const isFullName = !!firstName && !!lastName;

  const firstLastName = isFullName ? `${firstName} ${lastName}` : undefined;
  const lastFirstName = isFullName ? `${lastName}, ${firstName}` : undefined;

  // const firstLastName = isFullName ? `${firstName} ${lastName}${suffix ? ` ${suffix}` : ''}` : undefined;
  // const lastFirstName = isFullName ? `${lastName}${suffix ? ` ${suffix}` : ''}, ${firstName}` : undefined;

  const firstMiddleLastName = [firstName, middleName, lastName].filter((x) => !!x).join(' ') || undefined;

  const lastFirstMiddleName = [lastName, firstName, middleName].filter((x) => !!x).join(', ') || undefined;

  return {
    firstName,
    lastName,
    middleName,
    isFullName,
    firstLastName,
    lastFirstName,
    // suffix,
    firstMiddleLastName,
    lastFirstMiddleName,
  };
};
