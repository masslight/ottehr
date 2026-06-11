import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildEducationPrompt } from '../../src/ehr/generate-patient-education/helpers';
import { fetchMedlineLinks } from '../../src/shared/medlineplus';

// These cover the two load-bearing, easy-to-get-wrong-silently bits of Spanish patient education
// (OTR-2624): the MedlinePlus language query param, and the Spanish instruction in the AI prompt.

const medlineFeed = (titles: string[]): unknown => ({
  feed: { entry: titles.map((t) => ({ title: { _value: t }, link: [{ href: 'https://medlineplus.gov/x' }] })) },
});

describe('fetchMedlineLinks — language param', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requests English by default (informationRecipient.languageCode.c=en) with the ICD code', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => medlineFeed(['Ear Infections']) } as Response);

    await fetchMedlineLinks('H66.001');

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain('informationRecipient.languageCode.c=en');
    expect(url).toContain('mainSearchCriteria.v.c=H66.001');
  });

  it('requests Spanish when language=es', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => medlineFeed(['Infecciones de los oídos']) } as Response);

    await fetchMedlineLinks('H66.001', 'es');

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain('informationRecipient.languageCode.c=es');
  });
});

describe('buildEducationPrompt — output language', () => {
  const links = [{ title: 'Ear Infections', url: 'https://medlineplus.gov/ear' }];

  it('the English prompt does not ask for Spanish output', () => {
    const prompt = buildEducationPrompt('Acute otitis media', links); // defaults to English
    expect(prompt).toContain('English');
    expect(prompt).not.toMatch(/SPANISH|español/i);
  });

  it('the Spanish prompt instructs the model to write in Spanish', () => {
    const prompt = buildEducationPrompt('Acute otitis media', links, 'es');
    expect(prompt).toMatch(/SPANISH/);
    expect(prompt).toMatch(/español/i);
  });
});
