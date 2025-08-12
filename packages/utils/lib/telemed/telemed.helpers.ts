import { Location } from 'fhir/r4b';

export function getVirtualLocationStateAndName(location: Location): string {
  return `${location.address?.state} - ${location.name}`;
}
