import { Patient } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { getLegacyDataUrl } from './legacyData';

const searchParamsOf = (url: string): Record<string, string> => {
  const [path, query] = url.split('?');
  expect(path).toBe('/legacy-data');
  return Object.fromEntries(new URLSearchParams(query));
};

describe('getLegacyDataUrl', () => {
  it('prefills the search with the first name entry and an MM-DD-YYYY date of birth', () => {
    const patient: Patient = {
      resourceType: 'Patient',
      name: [
        { family: 'Black', given: ['Oliver', 'James'] },
        { family: 'Alias', given: ['Olly'] },
      ],
      birthDate: '2014-03-07',
    };

    expect(searchParamsOf(getLegacyDataUrl(patient))).toEqual({
      lastName: 'Black',
      firstName: 'Oliver',
      dob: '03-07-2014',
    });
  });

  it('sends empty values for missing name parts and birth date', () => {
    expect(searchParamsOf(getLegacyDataUrl({ resourceType: 'Patient' }))).toEqual({
      lastName: '',
      firstName: '',
      dob: '',
    });
  });

  it('encodes names that contain URL-reserved characters', () => {
    const patient: Patient = { resourceType: 'Patient', name: [{ family: "O'Neil & Sons", given: ['Ann-Marie'] }] };

    expect(searchParamsOf(getLegacyDataUrl(patient))).toMatchObject({
      lastName: "O'Neil & Sons",
      firstName: 'Ann-Marie',
    });
  });
});
