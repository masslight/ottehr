import { HumanName } from 'fhir/r4';

export function convertFhirNameToDisplayName(name: HumanName): string {
  return `${name.family}, ${name.given?.join(' ')}`;
}
