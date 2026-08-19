// The review surface accepts a note plus the narrative it came from. It deliberately does NOT accept
// `incremental` or a conversation `history`: it is not a turn in a conversation, it is one pass over a
// finished note, so those fields would be meaningless here.
import { describe, expect, it } from 'vitest';
import { ZambdaInput } from '../../shared/types/common';
import { MAX_NARRATIVE_CHARS, validateRequestParameters } from './validateRequestParameters';

const asInput = (body: unknown): ZambdaInput => ({ body: JSON.stringify(body) }) as ZambdaInput;

describe('easy-chart-review request validation', () => {
  it('requires a narrative', () => {
    expect(() => validateRequestParameters(asInput({}))).toThrow(/"narrative" is required/);
    expect(() => validateRequestParameters(asInput({ narrative: '   ' }))).toThrow(/"narrative" is required/);
  });

  it('refuses a body that is not there at all', () => {
    expect(() => validateRequestParameters({} as ZambdaInput)).toThrow(/No request body/);
  });

  it('caps the narrative', () => {
    const tooLong = { narrative: 'x'.repeat(MAX_NARRATIVE_CHARS + 1) };
    expect(() => validateRequestParameters(asInput(tooLong))).toThrow(/exceeds/);
  });

  it('keeps the note context and chart state it is given', () => {
    const params = validateRequestParameters(
      asInput({
        narrative: 'Sore throat, rapid strep positive.',
        noteContext: { medicalDecision: 'Strep pharyngitis, treated.' },
        chartState: '- Strep pharyngitis',
        chartedExamFindings: ['Erythematous pharynx'],
        encounterId: 'enc-1',
      })
    );
    expect(params.noteContext?.medicalDecision).toContain('Strep');
    expect(params.chartState).toBe('- Strep pharyngitis');
    expect(params.chartedExamFindings).toEqual(['Erythematous pharynx']);
    expect(params.encounterId).toBe('enc-1');
  });

  it('drops non-string entries from the string arrays rather than trusting them', () => {
    const params = validateRequestParameters(
      asInput({ narrative: 'n', chartedExamFindings: ['ok', 42, null, '  ', 'also ok'], templateTitles: 'nope' })
    );
    expect(params.chartedExamFindings).toEqual(['ok', 'also ok']);
    expect(params.templateTitles).toBeUndefined();
  });

  // Review renders the same patient block as the planner. Losing patientStatus here does not fail a
  // request — it silently makes the tail say "unknown", and the prompt's documented fallback then codes
  // every new patient into the established E&M family, overwriting a correct code from the plan.
  it('carries patientStatus through, and only the two legal values', () => {
    expect(validateRequestParameters(asInput({ narrative: 'n', patientStatus: 'new' })).patientStatus).toBe('new');
    expect(validateRequestParameters(asInput({ narrative: 'n', patientStatus: 'established' })).patientStatus).toBe(
      'established'
    );
    expect(
      validateRequestParameters(asInput({ narrative: 'n', patientStatus: 'brand-new' })).patientStatus
    ).toBeUndefined();
    expect(validateRequestParameters(asInput({ narrative: 'n' })).patientStatus).toBeUndefined();
  });

  it('rejects a non-string encounterId', () => {
    expect(() => validateRequestParameters(asInput({ narrative: 'n', encounterId: 7 }))).toThrow(/encounterId/);
  });
});
