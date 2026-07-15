import { Address, ContactPoint, Extension, Identifier, Organization } from 'fhir/r4b';

export const EMPLOYER_ORG_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/organization-type';
export const EMPLOYER_ORG_TYPE_CODE = 'occupational-medicine-employer';
export const CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM =
  'https://api.joincandidhealth.com/api/non-insurance-payers/v1/response/non_insurance_payer_id';
export const EMPLOYER_NOTES_EXTENSION_URL = 'https://extensions.ottehr.com/fhir/StructureDefinition/employer-notes';
/** Fixed description sent to Candid for every employer non-insurance payer. */
export const CANDID_EMPLOYER_DESCRIPTION = 'Employer';

export interface EmployerIdentifierInput {
  system?: string;
  value: string;
}

export interface EmployerAddressInput {
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface EmployerContactInput {
  phone?: string;
  fax?: string;
  email?: string;
  notes?: string;
}

export const buildEmployerType = (categoryText = 'Occupational Medicine'): NonNullable<Organization['type']> => [
  {
    text: categoryText,
    coding: [
      {
        system: EMPLOYER_ORG_TYPE_SYSTEM,
        code: EMPLOYER_ORG_TYPE_CODE,
      },
    ],
  },
];

export const isEmployerOrganization = (organization: Organization): boolean => {
  return (
    organization.type?.some((t) =>
      t.coding?.some((coding) => coding.system === EMPLOYER_ORG_TYPE_SYSTEM && coding.code === EMPLOYER_ORG_TYPE_CODE)
    ) ?? false
  );
};

export const normalizeIdentifier = (identifier?: EmployerIdentifierInput | null): Identifier[] | undefined => {
  if (!identifier) return undefined;

  return [
    {
      system: identifier.system || CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM,
      value: identifier.value,
    },
  ];
};

export const getCandidPayerIdFromOrganization = (org: Organization): string | undefined =>
  org.identifier?.find((id) => id.system === CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM)?.value;

export const setOrUpdateCandidIdentifier = (org: Organization, candidPayerId: string): Identifier[] => {
  const others = (org.identifier ?? []).filter((id) => id.system !== CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM);
  return [...others, { system: CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM, value: candidPayerId }];
};

export const normalizeAddress = (address?: EmployerAddressInput | null): Address[] | undefined => {
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

export const normalizeTelecom = (contact?: EmployerContactInput | null): ContactPoint[] | undefined => {
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

export const normalizeEmployerNotesExtension = (
  notes?: string | null,
  existingExtensions?: Extension[]
): Extension[] | undefined => {
  const nonNotesExtensions = (existingExtensions || []).filter((ext) => ext.url !== EMPLOYER_NOTES_EXTENSION_URL);
  const normalizedNotes = notes?.trim();

  if (!normalizedNotes) {
    return nonNotesExtensions.length > 0 ? nonNotesExtensions : undefined;
  }

  return [
    ...nonNotesExtensions,
    {
      url: EMPLOYER_NOTES_EXTENSION_URL,
      valueString: normalizedNotes,
    },
  ];
};
