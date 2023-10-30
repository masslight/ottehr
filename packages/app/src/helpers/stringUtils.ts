const needsDot = (title: string): boolean => {
  return ['Dr', 'Mr', 'Mrs', 'Ms'].includes(title);
};

// TODO add provider type
export const createProviderName = (provider: any, full?: boolean): string => {
  const title = `${provider.title}${needsDot(provider.title) ? '.' : ''}`;
  // Unless specifying not full name, return full name
  return `${title} ${full === false ? '' : provider['first name']} ${provider['last name']}`;
};

// TODO add patient type
export const createPatientName = (patient: any, lastNameFirst?: boolean): string => {
  if (lastNameFirst) {
    return `${patient['last name']}, ${patient['first name']}`;
  }
  return `${patient['first name']} ${patient['last name']}`;
};
