const needsDot = (title: string): boolean => {
  return ['Dr', 'Mr', 'Mrs', 'Ms'].includes(title);
};

// TODO add provider type
export const createProviderName = (provider: any, full?: boolean): string => {
  const title = `${provider.title}${needsDot(provider.title) ? '.' : ''}`;
  // Unless specifying not full name, return full name
  return `${title} ${full === false ? '' : provider.firstName} ${provider.lastName}`;
};

// TODO add patient type
export const createPatientName = (patient: any, lastNameFirst?: boolean): string => {
  if (lastNameFirst) {
    return `${patient.lastName}, ${patient.firstName}`;
  }
  return `${patient.firstName} ${patient.lastName}`;
};
