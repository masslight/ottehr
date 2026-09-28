import { describe, expect, it } from 'vitest';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const asInput = (body: unknown): ZambdaInput => ({ body: JSON.stringify(body), secrets: {} }) as ZambdaInput;

describe('easy-chart-review request validation', () => {
  it('refuses a missing body and a blank narrative', () => {
    expect(() => validateRequestParameters({ secrets: {} } as ZambdaInput)).toThrow();
    expect(() => validateRequestParameters(asInput({ narrative: '   ' }))).toThrow(/narrative/);
  });

  it('keeps the chart fallbacks the eval harness sends', () => {
    const params = validateRequestParameters(
      asInput({
        narrative: 'Sore throat, rapid strep positive.',
        noteContext: { medicalDecision: 'Strep pharyngitis, treated.' },
        chartState: '- Strep pharyngitis',
        chartedExamFindings: ['Erythematous pharynx'],
        patientStatus: 'new',
        encounterId: 'enc-1',
      })
    );
    expect(params).toMatchObject({
      noteContext: { medicalDecision: 'Strep pharyngitis, treated.' },
      chartState: '- Strep pharyngitis',
      chartedExamFindings: ['Erythematous pharynx'],
      patientStatus: 'new',
      encounterId: 'enc-1',
    });
  });

  it('rejects a wrongly typed field instead of dropping it', () => {
    expect(() => validateRequestParameters(asInput({ narrative: 'n', encounterId: 7 }))).toThrow(/encounterId/);
    expect(() => validateRequestParameters(asInput({ narrative: 'n', patientStatus: 'brand-new' }))).toThrow(
      /patientStatus/
    );
  });
});
