import { Address, ContactPoint } from 'fhir/r4b';

export interface OrganizationAddressInput {
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface OrganizationTelecomInput {
  phone?: string;
  fax?: string;
  email?: string;
}

/** An Organization.address with blank parts dropped; undefined when nothing is left. */
export const normalizeAddress = (address?: OrganizationAddressInput | null): Address[] | undefined => {
  if (!address) return undefined;

  const normalized: Address = {
    line: address.line?.filter(Boolean),
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
  };

  if (!normalized.line?.length) delete normalized.line;
  if (!normalized.city) delete normalized.city;
  if (!normalized.state) delete normalized.state;
  if (!normalized.postalCode) delete normalized.postalCode;
  if (!normalized.country) delete normalized.country;

  return Object.keys(normalized).length > 0 ? [normalized] : undefined;
};

/** One ContactPoint per given channel; undefined when none are given. */
export const normalizeTelecom = (contact?: OrganizationTelecomInput | null): ContactPoint[] | undefined => {
  if (!contact) return undefined;

  const telecom: ContactPoint[] = [];

  if (contact.phone) {
    telecom.push({ system: 'phone', value: contact.phone });
  }
  if (contact.fax) {
    telecom.push({ system: 'fax', value: contact.fax });
  }
  if (contact.email) {
    telecom.push({ system: 'email', value: contact.email });
  }

  return telecom.length > 0 ? telecom : undefined;
};
