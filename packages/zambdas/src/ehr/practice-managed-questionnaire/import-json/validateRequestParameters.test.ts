import { JSON_IMPORT_QUESTIONNAIRE_TAG, PRACTICE_MANAGED_QUESTIONNAIRE_TAG } from 'utils/lib/fhir/constants';
import { describe, expect, it } from 'vitest';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const baseQuestionnaire = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  resourceType: 'Questionnaire',
  url: 'https://ottehr.com/FHIR/Questionnaire/imported-form',
  title: 'Imported Form',
  status: 'active',
  version: '1.0.0',
  item: [{ linkId: 'page-1', type: 'group', item: [{ linkId: 'q-1', type: 'integer', text: 'Score' }] }],
  ...overrides,
});

const makeInput = (body: unknown): ZambdaInput =>
  ({
    body: JSON.stringify(body),
    headers: { Authorization: 'Bearer token' },
    secrets: null,
  }) as unknown as ZambdaInput;

describe('import-json validateRequestParameters', () => {
  it('applies the practice managed and json import tags and strips server managed fields', () => {
    const { questionnaire, questionnaireId } = validateRequestParameters(
      makeInput({
        questionnaire: baseQuestionnaire({
          id: 'should-be-removed',
          meta: { versionId: '3', tag: [{ system: 'other', code: 'keep-me' }, PRACTICE_MANAGED_QUESTIONNAIRE_TAG] },
        }),
      })
    );

    expect(questionnaireId).toBeUndefined();
    expect(questionnaire.id).toBeUndefined();
    expect(questionnaire.meta).toEqual({
      tag: [{ system: 'other', code: 'keep-me' }, PRACTICE_MANAGED_QUESTIONNAIRE_TAG, JSON_IMPORT_QUESTIONNAIRE_TAG],
    });
  });

  it('allows item types the questionnaire builder does not support', () => {
    const { questionnaire } = validateRequestParameters(makeInput({ questionnaire: baseQuestionnaire() }));
    expect(questionnaire.item?.[0].item?.[0].type).toBe('integer');
  });

  it('defaults name from the title', () => {
    const { questionnaire } = validateRequestParameters(makeInput({ questionnaire: baseQuestionnaire() }));
    expect(questionnaire.name).toBe('imported-form');
  });

  it('passes questionnaireId through for new versions', () => {
    const id = '0f5a7b36-3c1e-4c5e-9a55-2f6d1f0d9c11';
    const { questionnaireId } = validateRequestParameters(
      makeInput({ questionnaire: baseQuestionnaire(), questionnaireId: id })
    );
    expect(questionnaireId).toBe(id);
  });

  it.each([
    ['a non Questionnaire resource', { resourceType: 'Patient' }],
    ['a missing url', { url: undefined }],
    ['a missing title', { title: undefined }],
    ['a non semver version', { version: '2' }],
    ['a retired status', { status: 'retired' }],
    ['no items', { item: [] }],
    [
      'duplicate linkIds',
      {
        item: [
          { linkId: 'page-1', type: 'group', item: [{ linkId: 'dup', type: 'string' }] },
          { linkId: 'dup', type: 'string' },
        ],
      },
    ],
  ])('rejects %s', (_label, overrides) => {
    expect(() => validateRequestParameters(makeInput({ questionnaire: baseQuestionnaire(overrides) }))).toThrow();
  });

  it('rejects a missing auth token', () => {
    expect(() =>
      validateRequestParameters({ body: JSON.stringify({ questionnaire: baseQuestionnaire() }) } as ZambdaInput)
    ).toThrow();
  });
});
