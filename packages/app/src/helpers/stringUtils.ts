import { Practitioner } from 'fhir/r4';
import { ProviderData } from '../store/types';

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

export const createProvider = (providerProfile: Practitioner | undefined): ProviderData => {
  // TODO: fix the type of obj
  const getProviderProperty = (obj: any, path: string, defaultValue: ''): any => {
    const keys = path.split('.');
    return keys.reduce(
      (currentObj, key) => (currentObj && currentObj[key] !== undefined ? currentObj[key] : defaultValue),
      obj
    );
  };
  const email = getProviderProperty(providerProfile, 'telecom.0.value', '');
  const firstName = getProviderProperty(providerProfile, 'name.0.given.0', '');
  const lastName = getProviderProperty(providerProfile, 'name.0.family', '');
  const slug = getProviderProperty(providerProfile, 'identifier.0.value', '');
  const title = getProviderProperty(providerProfile, 'name.0.prefix.0', '');
  const id = getProviderProperty(providerProfile, 'id', '');

  return {
    email: email,
    firstName: firstName,
    id: id,
    lastName: lastName,
    slug: slug,
    title: title,
  };
};
