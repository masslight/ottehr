import { Patient, Resource } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { deduplicateUnbundledResources } from './deduplicateUnbundledResources';

describe('deduplicateUnbundledResources', () => {
  it('should remove duplicate resources by resourceType/id', () => {
    const resources = [
      { resourceType: 'Patient', id: 'p1', name: [{ family: 'Smith' }] },
      { resourceType: 'Patient', id: 'p1', name: [{ family: 'Smith' }] },
      { resourceType: 'Patient', id: 'p2', name: [{ family: 'Doe' }] },
    ] as Patient[];
    const result = deduplicateUnbundledResources(resources);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['p1', 'p2']);
  });

  it('should keep resources with same id but different resourceType', () => {
    const resources = [
      { resourceType: 'Patient', id: '123' },
      { resourceType: 'Practitioner', id: '123' },
    ] as Resource[];
    const result = deduplicateUnbundledResources(resources);
    expect(result).toHaveLength(2);
  });

  it('should return empty array for empty input', () => {
    expect(deduplicateUnbundledResources([])).toEqual([]);
  });

  it('should keep the last occurrence when duplicates exist', () => {
    const resources = [
      { resourceType: 'Patient', id: 'p1', name: [{ family: 'First' }] },
      { resourceType: 'Patient', id: 'p1', name: [{ family: 'Second' }] },
    ] as Patient[];
    const result = deduplicateUnbundledResources(resources);
    expect(result).toHaveLength(1);
    expect((result[0] as Patient).name?.[0].family).toBe('Second');
  });

  it('should handle mixed resource types', () => {
    const resources = [
      { resourceType: 'Patient', id: 'p1' },
      { resourceType: 'Practitioner', id: 'pr1' },
      { resourceType: 'Patient', id: 'p1' },
      { resourceType: 'Practitioner', id: 'pr2' },
    ] as Resource[];
    const result = deduplicateUnbundledResources(resources);
    expect(result).toHaveLength(3);
  });
});
