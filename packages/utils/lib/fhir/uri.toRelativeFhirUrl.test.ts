import { describe, expect, it } from 'vitest';
import { toRelativeFhirUrl } from './uri';

describe('toRelativeFhirUrl', () => {
  it('strips the FHIR base URL when it is known', () => {
    expect(
      toRelativeFhirUrl(
        'https://fhir-api.zapehr.com/r4/Observation?encounter=x&_page=2',
        'https://fhir-api.zapehr.com/r4'
      )
    ).toBe('Observation?encounter=x&_page=2');
    expect(
      toRelativeFhirUrl('https://fhir-api.zapehr.com/r4/Observation?encounter=x', 'https://fhir-api.zapehr.com/r4/')
    ).toBe('Observation?encounter=x');
  });

  it('otherwise drops the path prefix ahead of the resource type', () => {
    expect(toRelativeFhirUrl('https://fhir-api.zapehr.com/r4/Observation?encounter=x&_page=2')).toBe(
      'Observation?encounter=x&_page=2'
    );
    expect(toRelativeFhirUrl('https://host/some/prefix/Task?based-on=y', 'https://other-host/r4')).toBe(
      'Task?based-on=y'
    );
  });

  it('returns input that is not a URL unchanged', () => {
    expect(toRelativeFhirUrl('Task?based-on=y')).toBe('Task?based-on=y');
  });
});
