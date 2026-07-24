import { describe, expect, it } from 'vitest';
import { FhirQuestionnaireSubset, isLatestVersion, patchQuestionnaireVersion } from './index';

const questionnaire = (overrides: Partial<FhirQuestionnaireSubset> = {}): FhirQuestionnaireSubset => ({
  id: 'q-1',
  title: 'Test Form',
  status: 'active',
  url: 'https://ottehr.com/FHIR/Questionnaire/test-form',
  version: '1.0.0',
  ...overrides,
});

describe('isLatestVersion', () => {
  it('returns true when candidate has a higher major version', () => {
    const candidate = questionnaire({ version: '2.0.0' });
    const current = questionnaire({ version: '1.9.9' });

    expect(isLatestVersion(candidate, current)).toBe(true);
  });

  it('returns true when candidate has a higher minor version', () => {
    const candidate = questionnaire({ version: '1.2.0' });
    const current = questionnaire({ version: '1.1.9' });

    expect(isLatestVersion(candidate, current)).toBe(true);
  });

  it('returns true when candidate has a higher patch version', () => {
    const candidate = questionnaire({ version: '1.0.2' });
    const current = questionnaire({ version: '1.0.1' });

    expect(isLatestVersion(candidate, current)).toBe(true);
  });

  it('returns false when candidate has a lower version', () => {
    const candidate = questionnaire({ version: '1.0.0' });
    const current = questionnaire({ version: '1.0.1' });

    expect(isLatestVersion(candidate, current)).toBe(false);
  });

  it('falls back to lastUpdated when versions are equal', () => {
    const candidate = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-02T00:00:00.000Z' },
    });
    const current = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-01T00:00:00.000Z' },
    });

    expect(isLatestVersion(candidate, current)).toBe(true);
  });

  it('returns false when versions are equal and candidate lastUpdated is older', () => {
    const candidate = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-01T00:00:00.000Z' },
    });
    const current = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-02T00:00:00.000Z' },
    });

    expect(isLatestVersion(candidate, current)).toBe(false);
  });

  it('returns true when versions and lastUpdated are both equal', () => {
    const candidate = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-01T00:00:00.000Z' },
    });
    const current = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-01T00:00:00.000Z' },
    });

    expect(isLatestVersion(candidate, current)).toBe(true);
  });

  it('defaults missing versions to the base version so equal defaults compare by lastUpdated', () => {
    const candidate = questionnaire({
      version: undefined,
      meta: { lastUpdated: '2024-01-02T00:00:00.000Z' },
    });
    const current = questionnaire({
      version: undefined,
      meta: { lastUpdated: '2024-01-01T00:00:00.000Z' },
    });

    expect(isLatestVersion(candidate, current)).toBe(true);
  });

  it('treats a missing lastUpdated as an invalid date, comparing as less than any real date', () => {
    const candidate = questionnaire({ version: '1.0.0', meta: undefined });
    const current = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-01T00:00:00.000Z' },
    });

    expect(isLatestVersion(candidate, current)).toBe(false);
  });
});

describe('patchQuestionnaireVersion', () => {
  it('increments the patch segment', () => {
    expect(patchQuestionnaireVersion('1.2.3')).toBe('1.2.4');
  });

  it('increments from zero', () => {
    expect(patchQuestionnaireVersion('1.0.0')).toBe('1.0.1');
  });

  it('leaves major and minor segments unchanged', () => {
    expect(patchQuestionnaireVersion('3.4.9')).toBe('3.4.10');
  });
});
