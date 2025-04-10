import { Address, FhirResource, HealthcareService, Location, Practitioner } from 'fhir/r4b';
import { getFullName } from 'utils';

export const addressStringFromAddress = (address: Address): string => {
  let addressString = '';
  if (address.line) {
    addressString += `, ${address.line}`;
  }
  if (address.city) {
    addressString += `, ${address.city}`;
  }
  if (address.state) {
    addressString += `, ${address.state}`;
  }
  if (address.postalCode) {
    addressString += `, ${address.postalCode}`;
  }
  // return without trailing comma

  if (addressString !== '') {
    addressString = addressString.substring(2);
  }
  return addressString;
};

export const getNameForOwner = (owner: FhirResource): string => {
  let name: string | undefined = '';
  if (owner.resourceType === 'Location') {
    name = (owner as Location).name;
  } else if (owner.resourceType === 'Practitioner') {
    name = getFullName(owner as Practitioner);
  } else if (owner.resourceType === 'HealthcareService') {
    name = (owner as HealthcareService).name;
  }
  if (name) {
    return name;
  }
  return `${owner.resourceType}/${owner.id}`;
};
