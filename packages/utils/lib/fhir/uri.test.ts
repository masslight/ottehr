import { describe, expect, it } from 'vitest';
import { addSearchParams, SearchParams } from './uri';

describe('addSearchParams', () => {
  it('should return url unchanged when no search params', () => {
    expect(addSearchParams('/Patient')).toBe('/Patient');
    expect(addSearchParams('/Patient', undefined)).toBe('/Patient');
  });

  it('should add _count parameter', () => {
    expect(addSearchParams('/Patient', { _count: 20 })).toBe('/Patient?_count=20');
  });

  it('should add _count=0', () => {
    expect(addSearchParams('/Patient', { _count: 0 })).toBe('/Patient?_count=0');
  });

  it('should add _sort parameter', () => {
    expect(addSearchParams('/Patient', { _sort: 'date,-name' })).toBe('/Patient?_sort=date,-name');
  });

  it('should add single _include', () => {
    expect(addSearchParams('/Patient', { _include: 'Patient:organization' })).toBe(
      '/Patient?_include=Patient:organization'
    );
  });

  it('should add multiple _include parameters', () => {
    const result = addSearchParams('/Patient', {
      _include: ['Patient:organization', 'Patient:generalPractitioner'],
    });
    expect(result).toBe('/Patient?_include=Patient:organization&_include=Patient:generalPractitioner');
  });

  it('should add single _revinclude', () => {
    expect(addSearchParams('/Patient', { _revinclude: 'Provenance:target' })).toBe(
      '/Patient?_revinclude=Provenance:target'
    );
  });

  it('should add multiple _revinclude parameters', () => {
    const result = addSearchParams('/Patient', {
      _revinclude: ['Provenance:target', 'Observation:subject'],
    });
    expect(result).toBe('/Patient?_revinclude=Provenance:target&_revinclude=Observation:subject');
  });

  it('should add _summary parameter', () => {
    expect(addSearchParams('/Patient', { _summary: 'count' })).toBe('/Patient?_summary=count');
  });

  it('should add _total parameter', () => {
    expect(addSearchParams('/Patient', { _total: 'accurate' })).toBe('/Patient?_total=accurate');
  });

  it('should add _elements as comma-separated list', () => {
    expect(addSearchParams('/Patient', { _elements: ['identifier', 'active', 'name'] })).toBe(
      '/Patient?_elements=identifier,active,name'
    );
  });

  it('should add single _elements', () => {
    expect(addSearchParams('/Patient', { _elements: 'identifier' })).toBe('/Patient?_elements=identifier');
  });

  it('should add _contained parameter', () => {
    expect(addSearchParams('/Patient', { _contained: 'true' })).toBe('/Patient?_contained=true');
  });

  it('should add _tag as comma-separated list', () => {
    expect(addSearchParams('/Patient', { _tag: ['tag1', 'tag2'] })).toBe('/Patient?_tag=tag1,tag2');
  });

  it('should add single _tag', () => {
    expect(addSearchParams('/Patient', { _tag: 'my-tag' })).toBe('/Patient?_tag=my-tag');
  });

  it('should combine multiple base params', () => {
    const result = addSearchParams('/Patient', {
      _count: 10,
      _sort: 'name',
      _summary: 'true',
    });
    expect(result).toBe('/Patient?_count=10&_sort=name&_summary=true');
  });

  it('should append with & when url already has query params', () => {
    expect(addSearchParams('/Patient?active=true', { _count: 10 })).toBe('/Patient?active=true&_count=10');
  });

  it('should handle advanced search params with value property', () => {
    const params: SearchParams = {
      name: { type: 'string', value: 'Smith' },
      birthdate: { type: 'date', value: '2000-01-01' },
    };
    const result = addSearchParams('/Patient', params);
    expect(result).toContain('name=Smith');
    expect(result).toContain('birthdate=2000-01-01');
  });
});
