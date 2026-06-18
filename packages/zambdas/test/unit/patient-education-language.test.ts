import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildEducationPrompt } from '../../src/ehr/generate-patient-education/helpers';
import { validateRequestParameters as validateGeneratePatientEducation } from '../../src/ehr/generate-patient-education/validateRequestParameters';
import { validateRequestParameters as validateSaveApprovedPatientEducation } from '../../src/ehr/save-approved-patient-education/validateRequestParameters';
import { validateRequestParameters as validateSavePatientEducationPdf } from '../../src/ehr/save-patient-education-pdf/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared';
import { fetchMedlineLinks } from '../../src/shared/medlineplus';

// These cover the two load-bearing, easy-to-get-wrong-silently bits of Spanish patient education
// (OTR-2624): the MedlinePlus language query param, and the Spanish instruction in the AI prompt.

const medlineFeed = (titles: string[]): unknown => ({
  feed: { entry: titles.map((t) => ({ title: { _value: t }, link: [{ href: 'https://medlineplus.gov/x' }] })) },
});

const makeZambdaInput = (body: unknown): ZambdaInput => ({
  headers: null,
  body: JSON.stringify(body),
  secrets: {} as NonNullable<ZambdaInput['secrets']>,
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

describe('patient education language validation', () => {
  it('accepts supported languages for generation and rejects unsupported ones', () => {
    expect(
      validateGeneratePatientEducation(
        makeZambdaInput({ icdCode: 'H66.001', icdDescription: 'Acute otitis media', language: 'es' })
      ).language
    ).toBe('es');

    expect(() =>
      validateGeneratePatientEducation(
        makeZambdaInput({ icdCode: 'H66.001', icdDescription: 'Acute otitis media', language: 'fr' })
      )
    ).toThrow();
  });

  it('accepts supported languages for approved PDFs and rejects unsupported ones', () => {
    const validBody = {
      pdfBase64: 'abc',
      title: 'Patient Education: Ear Infection',
      icdCodes: [{ code: 'H66.001', display: 'Acute otitis media' }],
      language: 'en',
    };

    expect(validateSaveApprovedPatientEducation(makeZambdaInput(validBody)).language).toBe('en');
    expect(() => validateSaveApprovedPatientEducation(makeZambdaInput({ ...validBody, language: 'fr' }))).toThrow();
  });

  it('accepts supported languages for visit PDFs and strips the removed relatedDocumentReferenceId field', () => {
    const result = validateSavePatientEducationPdf(
      makeZambdaInput({
        encounterId: 'encounter-1',
        patientId: 'patient-1',
        title: 'Patient Education: Ear Infection',
        language: 'es',
        relatedDocumentReferenceId: 'doc-ref-1',
        sections: [
          {
            content: '## Overview\nCare instructions',
            patientTitle: 'Ear Infection',
            icdCode: 'H66.001',
            icdDescription: 'Acute otitis media',
          },
        ],
      })
    );

    expect(result.language).toBe('es');
    expect(result).not.toHaveProperty('relatedDocumentReferenceId');
    expect(() =>
      validateSavePatientEducationPdf(
        makeZambdaInput({
          encounterId: 'encounter-1',
          patientId: 'patient-1',
          title: 'Patient Education: Ear Infection',
          language: 'fr',
          sections: [
            {
              content: '## Overview\nCare instructions',
              patientTitle: 'Ear Infection',
              icdCode: 'H66.001',
              icdDescription: 'Acute otitis media',
            },
          ],
        })
      )
    ).toThrow();
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
