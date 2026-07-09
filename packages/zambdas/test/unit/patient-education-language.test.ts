import { DocumentReference } from 'fhir/r4b';
import {
  CODE_SYSTEM_ICD_10,
  PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE,
  PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL,
  PatientEducationLanguage,
} from 'utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildEducationPrompt } from '../../src/ehr/generate-patient-education/helpers';
import { validateRequestParameters as validateGeneratePatientEducation } from '../../src/ehr/generate-patient-education/validateRequestParameters';
import { validateRequestParameters as validateSaveApprovedPatientEducation } from '../../src/ehr/save-approved-patient-education/validateRequestParameters';
import { validateRequestParameters as validateSavePatientEducationPdf } from '../../src/ehr/save-patient-education-pdf/validateRequestParameters';
import { findConflictingApprovedEducationIcdCodes } from '../../src/ehr/shared/approved-patient-education-helpers';
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

describe('findConflictingApprovedEducationIcdCodes — language-scoped duplicate check', () => {
  const approvedDocRef = (id: string, icdCodes: string[], language?: PatientEducationLanguage): DocumentReference => ({
    resourceType: 'DocumentReference',
    id,
    status: 'current',
    type: { coding: [{ code: PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE }] },
    content: [{ attachment: { url: `https://z3/${id}.pdf`, ...(language ? { language } : {}) } }],
    extension: [
      {
        url: PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL,
        extension: icdCodes.map((code) => ({
          url: 'icdCode',
          valueCoding: { system: CODE_SYSTEM_ICD_10, code, display: code },
        })),
      },
    ],
  });

  const icd = (code: string): { code: string; display: string } => ({ code, display: code });

  it('does NOT flag a code used by an approved PDF of the OTHER language (EN and ES coexist)', () => {
    // QA repro: an English PDF for A98.0 exists; editing the Spanish PDF back to A98.0 must be allowed.
    const spanishTarget = approvedDocRef('es-doc', ['A98.8'], 'es');
    const englishDoc = approvedDocRef('en-doc', ['A98.0'], 'en');

    expect(findConflictingApprovedEducationIcdCodes(spanishTarget, [englishDoc], [icd('A98.0')])).toEqual([]);
  });

  it('flags a code already used by another approved PDF of the SAME language', () => {
    const spanishTarget = approvedDocRef('es-doc', ['A98.8'], 'es');
    const otherSpanishDoc = approvedDocRef('es-doc-2', ['A98.0'], 'es');

    expect(findConflictingApprovedEducationIcdCodes(spanishTarget, [otherSpanishDoc], [icd('A98.0')])).toEqual([
      'A98.0',
    ]);
  });

  it('treats legacy PDFs without a language tag as English', () => {
    const legacyDoc = approvedDocRef('legacy-doc', ['A98.0']);

    const englishTarget = approvedDocRef('en-doc', ['B01.9'], 'en');
    expect(findConflictingApprovedEducationIcdCodes(englishTarget, [legacyDoc], [icd('A98.0')])).toEqual(['A98.0']);

    const spanishTarget = approvedDocRef('es-doc', ['B01.9'], 'es');
    expect(findConflictingApprovedEducationIcdCodes(spanishTarget, [legacyDoc], [icd('A98.0')])).toEqual([]);
  });

  it('ignores the target itself when it appears in the search results', () => {
    const target = approvedDocRef('es-doc', ['A98.0'], 'es');

    expect(findConflictingApprovedEducationIcdCodes(target, [target], [icd('A98.0')])).toEqual([]);
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
