import { Practitioner } from 'fhir/r4b';
import { PROVIDER_TYPE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { makeProviderTypeExtension } from 'utils/lib/fhir/practitioners';
import { PHRASES_EXTENSION_URL, USER_TIMEZONE_EXTENSION_URL } from 'utils/lib/types/constants';
import { describe, expect, test } from 'vitest';
import { applyProviderTypeExtension } from '../../src/ehr/update-user/helpers';

const phrasesExtension = { url: PHRASES_EXTENSION_URL, valueString: '[{"key":".hpi","value":"HPI:"}]' };
const timezoneExtension = { url: USER_TIMEZONE_EXTENSION_URL, valueString: 'America/New_York' };

const urlsOf = (practitioner: Practitioner): (string | undefined)[] =>
  (practitioner.extension ?? []).map((extension) => extension.url);

describe('applyProviderTypeExtension', () => {
  test('keeps unrelated extensions when a provider type is supplied', () => {
    const practitioner: Practitioner = {
      resourceType: 'Practitioner',
      extension: [phrasesExtension, timezoneExtension],
    };
    applyProviderTypeExtension(practitioner, makeProviderTypeExtension('MD'));
    expect(urlsOf(practitioner)).toEqual([
      PHRASES_EXTENSION_URL,
      USER_TIMEZONE_EXTENSION_URL,
      PROVIDER_TYPE_EXTENSION_URL,
    ]);
  });

  test('keeps unrelated extensions when no provider type is supplied', () => {
    const practitioner: Practitioner = {
      resourceType: 'Practitioner',
      extension: [phrasesExtension, timezoneExtension],
    };
    applyProviderTypeExtension(practitioner, makeProviderTypeExtension(undefined));
    expect(practitioner.extension).toEqual([phrasesExtension, timezoneExtension]);
  });

  test('replaces an existing provider type extension instead of duplicating it', () => {
    const practitioner: Practitioner = {
      resourceType: 'Practitioner',
      extension: [phrasesExtension, ...makeProviderTypeExtension('DO')!],
    };
    applyProviderTypeExtension(practitioner, makeProviderTypeExtension('MD'));
    expect(urlsOf(practitioner)).toEqual([PHRASES_EXTENSION_URL, PROVIDER_TYPE_EXTENSION_URL]);
    expect(practitioner.extension?.[1]).toEqual(makeProviderTypeExtension('MD')![0]);
  });

  test('clears the provider type extension when none is supplied', () => {
    const practitioner: Practitioner = {
      resourceType: 'Practitioner',
      extension: [phrasesExtension, ...makeProviderTypeExtension('DO')!],
    };
    applyProviderTypeExtension(practitioner, undefined);
    expect(practitioner.extension).toEqual([phrasesExtension]);
  });

  test('leaves extension undefined when there is nothing left to keep', () => {
    const practitioner: Practitioner = {
      resourceType: 'Practitioner',
      extension: [...makeProviderTypeExtension('DO')!],
    };
    applyProviderTypeExtension(practitioner, undefined);
    expect(practitioner.extension).toBeUndefined();
  });

  test('adds the provider type extension when the practitioner had none', () => {
    const practitioner: Practitioner = { resourceType: 'Practitioner' };
    applyProviderTypeExtension(practitioner, makeProviderTypeExtension('MD'));
    expect(practitioner.extension).toEqual(makeProviderTypeExtension('MD'));
  });
});
