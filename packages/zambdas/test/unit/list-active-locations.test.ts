import Oystehr from '@oystehr/sdk';
import { Location } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { LOCATION_FORM_EXTENSION_URL, LOCATION_IN_PERSON_CODE, LOCATION_VIRTUAL_CODE } from 'utils/lib/fhir/location';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../src/ehr/locations/list-active-locations/index';

vi.mock('utils/lib/fhir/getAllFhirSearchPages', () => ({ getAllFhirSearchPages: vi.fn() }));

const formCoding = (code: string): Location['extension'] => [
  { url: LOCATION_FORM_EXTENSION_URL, valueCoding: { code } },
];

const locations: Location[] = [
  { resourceType: 'Location', id: 'legacy', name: 'Legacy Clinic' }, // no coding: treated as in-person
  {
    resourceType: 'Location',
    id: 'clinic',
    name: 'Main Street Clinic',
    extension: formCoding(LOCATION_IN_PERSON_CODE),
  },
  { resourceType: 'Location', id: 'virtual', name: 'New York', extension: formCoding(LOCATION_VIRTUAL_CODE) },
  {
    resourceType: 'Location',
    id: 'both',
    extension: [...formCoding(LOCATION_VIRTUAL_CODE)!, ...formCoding(LOCATION_IN_PERSON_CODE)!],
  },
];

describe('list-active-locations - performEffect', () => {
  const oystehr = {} as Oystehr;

  beforeEach(() => {
    vi.mocked(getAllFhirSearchPages).mockReset();
    vi.mocked(getAllFhirSearchPages).mockResolvedValue(locations);
  });

  it('returns every active location as id + name by default, projecting only id and name', async () => {
    const { locations: result } = await performEffect(oystehr, {});

    expect(result.map((l) => l.id)).toEqual(['legacy', 'clinic', 'virtual', 'both']);
    expect(result.find((l) => l.id === 'both')?.name).toBe('both'); // name falls back to id
    const [{ params }] = vi.mocked(getAllFhirSearchPages).mock.calls[0];
    expect(params).toContainEqual({ name: 'status', value: 'active' });
    expect(params).toContainEqual({ name: '_elements', value: 'id,name' });
  });

  it('keeps only in-person locations when inPersonOnly is set, fetching the extension it filters on', async () => {
    const { locations: result } = await performEffect(oystehr, { inPersonOnly: true });

    expect(result.map((l) => l.id)).toEqual(['legacy', 'clinic', 'both']);
    const [{ params }] = vi.mocked(getAllFhirSearchPages).mock.calls[0];
    expect(params).toContainEqual({ name: '_elements', value: 'id,name,extension' });
  });
});
