import { Organization } from 'fhir/r4b';
import {
  RADIOLOGY_PERFORMING_ORGANIZATION_CONTAINED_ID,
  RADIOLOGY_PERFORMING_ORGANIZATION_IDENTIFIER_SYSTEM,
} from 'utils';
import { describe, expect, test } from 'vitest';
import { buildRadiologyOrderContent, RadiologyOrderContentInput } from '../../src/ehr/radiology/create-order';

const baseInput: RadiologyOrderContentInput = {
  diagnoses: [{ code: 'R07.9', display: 'Chest pain, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' }],
  cpt: { code: '71045', display: 'X-ray of chest, 1 view', system: 'http://www.ama-assn.org/go/cpt' },
  stat: false,
  clinicalHistory: '',
  consentObtained: false,
};

const containedOrg = (input: RadiologyOrderContentInput): Organization | undefined =>
  buildRadiologyOrderContent(input).contained?.find(
    (r): r is Organization =>
      r.resourceType === 'Organization' && r.id === RADIOLOGY_PERFORMING_ORGANIZATION_CONTAINED_ID
  );

// org-1: (identifier.count() + name.count()) > 0 (external phone/fax-only orders used to 500 here).
const satisfiesOrg1 = (org: Organization): boolean => (org.identifier?.length ?? 0) + (org.name ? 1 : 0) > 0;

describe('buildRadiologyOrderContent - performing organization satisfies FHIR org-1', () => {
  test('stamps an identifier when the org has only a phone/fax and no name', () => {
    const org = containedOrg({
      ...baseInput,
      external: true,
      performingOrganization: { phone: '(202) 713-9680', fax: '(202) 713-9680' },
    });

    expect(org).toBeDefined();
    expect(org!.name).toBeUndefined();
    expect(org!.identifier).toEqual([
      { system: RADIOLOGY_PERFORMING_ORGANIZATION_IDENTIFIER_SYSTEM, value: 'external' },
    ]);
    expect(satisfiesOrg1(org!)).toBe(true);
  });

  test('keeps the name and still stamps an identifier when a name is provided', () => {
    const org = containedOrg({
      ...baseInput,
      external: true,
      performingOrganization: { name: 'Test Imaging Center', address: '1 Main St' },
    });

    expect(org!.name).toBe('Test Imaging Center');
    expect(org!.address).toEqual([{ text: '1 Main St' }]);
    expect(satisfiesOrg1(org!)).toBe(true);
  });

  test('does not add a contained organization for non-external orders', () => {
    const content = buildRadiologyOrderContent({
      ...baseInput,
      external: false,
      performingOrganization: { phone: '(202) 713-9680' },
    });

    expect(content.contained).toBeUndefined();
    expect(content.performer).toBeUndefined();
  });
});

// Oystehr rejects a whitespace-only valueString ("Invalid empty string") while accepting a genuinely
// empty one, so a clinical history of " " must never reach the order-detail extension.
describe('buildRadiologyOrderContent - clinical history never emits a blank valueString', () => {
  const valueStrings = (input: RadiologyOrderContentInput): (string | undefined)[] =>
    buildRadiologyOrderContent(input)
      .contentExtensions.flatMap((ext) => ext.extension ?? [])
      .flatMap((param) => param.extension ?? [])
      .filter((leaf) => leaf.valueString !== undefined)
      .map((leaf) => leaf.valueString);

  test.each([' ', '   ', '\t', '\n'])('drops the clinical-history extension for %j', (history) => {
    const emitted = valueStrings({ ...baseInput, clinicalHistory: history });

    expect(emitted).not.toContain(history);
    expect(emitted.every((v) => v!.trim().length > 0)).toBe(true);
  });

  test('keeps a real clinical history, trimmed of surrounding whitespace', () => {
    const emitted = valueStrings({ ...baseInput, clinicalHistory: '  Took an arrow to the knee  ' });

    expect(emitted).toContain('Took an arrow to the knee');
  });
});
