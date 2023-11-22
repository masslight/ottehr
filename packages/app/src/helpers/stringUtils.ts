const needsDot = (title: string): boolean => {
  return ['Dr', 'Mr', 'Mrs', 'Ms'].includes(title);
};

// TODO add provider type
export const createProviderName = (provider: any, full?: boolean): string => {
  const title = provider.title ? `${provider.title}${needsDot(provider.title) ? '.' : ''}` : '';
  const firstName = !full ? (provider.firstName ? `${provider.firstName}` : '') : '';
  const lastName = provider.lastName ? provider.lastName : '';
  if (!firstName && !lastName) {
    console.error('Missing both firstName and lastName');
    return '';
  }
  // Unless specifying not full name, return full name
  return [title, firstName, lastName].filter(Boolean).join(' ');
};

// TODO add patient type
export const createPatientName = (patient: any, lastNameFirst?: boolean): string => {
  if (lastNameFirst) {
    return `${patient.lastName}, ${patient.firstName}`;
  }
  return `${patient.firstName} ${patient.lastName}`;
};

export const createSlugUrl = (slug: string | undefined): string => {
  return `${import.meta.env.VITE_APP_BASE_URL}/${slug}`;
};
