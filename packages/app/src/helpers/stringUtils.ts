import { Practitioner } from 'fhir/r4';
import { Provider } from '../store/types';

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

export const createProvider = (providerProfile: Practitioner | undefined): Provider => {
  return {
    email: providerProfile?.telecom && providerProfile.telecom[0].value ? providerProfile.telecom[0].value : '',
    firstName: providerProfile?.name && providerProfile.name[0].given ? providerProfile.name[0].given[0] : '',
    lastName: providerProfile?.name && providerProfile.name[0].family ? providerProfile.name[0].family : '',
    slug: providerProfile?.identifier && providerProfile.identifier[0].value ? providerProfile.identifier[0].value : '',
    title: providerProfile?.name && providerProfile.name[0].prefix ? providerProfile.name[0].prefix[0] : '',
  };
};
