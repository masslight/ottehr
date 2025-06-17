import { HumanName } from 'fhir/r4b';

export function convertFhirNameToDisplayName(name: HumanName): string {
  return `${name.family}, ${name.given?.join(' ')}`;
}
