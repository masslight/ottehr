import { Location } from 'fhir/r4b';
import {
  CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
  FHIR_IDENTIFIER_CLIA,
  FHIR_IDENTIFIER_NPI,
  getNPI,
  SaveServiceFacilityInput,
  ServiceFacilityItem,
} from 'utils';

export function getCLIA(location: Location): string | undefined {
  return location.identifier?.find((identifier) => identifier.system === FHIR_IDENTIFIER_CLIA)?.value;
}

export function getPlaceOfServiceCode(location: Location): string | undefined {
  return location.extension?.find((ext) => ext.url === CODE_SYSTEM_CMS_PLACE_OF_SERVICE)?.valueString;
}

// FHIR Location -> the flat shape the billing UI consumes.
export function mapServiceFacility(location: Location): ServiceFacilityItem {
  const address = location.address;
  const [zip, zipPlus4 = ''] = (address?.postalCode ?? '').split('-');
  return {
    id: location.id ?? '',
    name: location.name ?? '',
    addressLine1: address?.line?.[0] ?? '',
    addressLine2: address?.line?.[1] ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
    zip: zip ?? '',
    zipPlus4,
    npi: getNPI(location) ?? '',
    clia: getCLIA(location) ?? '',
    posCode: getPlaceOfServiceCode(location) ?? '',
    status: location.status === 'inactive' ? 'inactive' : 'active',
  };
}

// Pass `existing` for updates (read-modify-write); omit it to build a new active facility.
// Defined params will overwrite existing values, null params will clear them, and undefined will leave them unchanged.
export function applyServiceFacilityInput(params: SaveServiceFacilityInput, existing?: Location): Location {
  const location: Location = existing
    ? structuredClone(existing)
    : {
        resourceType: 'Location',
        status: 'active',
      };

  if (params.name !== undefined) location.name = params.name;

  const address: NonNullable<Location['address']> = { ...location.address };
  if (params.addressLine1 !== undefined) {
    address.line = [params.addressLine1, ...(params.addressLine2 ? [params.addressLine2] : [])];
  }
  if (params.city !== undefined) address.city = params.city;
  if (params.state !== undefined) address.state = params.state;
  if (params.zip !== undefined) {
    address.postalCode = params.zipPlus4 ? `${params.zip}-${params.zipPlus4}` : params.zip;
  }
  if (Object.keys(address).length > 0) location.address = address;

  if (params.npi !== undefined) {
    location.identifier = setIdentifier(location.identifier, FHIR_IDENTIFIER_NPI, params.npi);
  }
  if (params.clia !== undefined) {
    location.identifier = setIdentifier(location.identifier, FHIR_IDENTIFIER_CLIA, params.clia);
  }
  if (params.posCode !== undefined) {
    location.extension = setExtension(location.extension, CODE_SYSTEM_CMS_PLACE_OF_SERVICE, params.posCode);
  }

  return location;
}

// Replace the entry for `system` with `value`, or remove it when `value` is null.
function setIdentifier(
  identifiers: Location['identifier'],
  system: string,
  value: string | null
): Location['identifier'] {
  const others = (identifiers ?? []).filter((identifier) => identifier.system !== system);
  if (value === null) {
    return others.length > 0 ? others : undefined;
  }
  return [
    ...others,
    {
      system,
      value,
    },
  ];
}

// Replace the extension for `url` with `valueString`, or remove it when `valueString` is null.
function setExtension(
  extensions: Location['extension'],
  url: string,
  valueString: string | null
): Location['extension'] {
  const others = (extensions ?? []).filter((ext) => ext.url !== url);
  if (valueString === null) {
    return others.length > 0 ? others : undefined;
  }
  return [
    ...others,
    {
      url,
      valueString,
    },
  ];
}
