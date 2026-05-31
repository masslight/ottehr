import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Contract test: the intake app-chrome translations must stay in sync between English and
 * Spanish. Every key in i18n-en.json must have a counterpart in i18n-es.json and vice versa.
 *
 * The one intentional exception is the flat `questionnaire.*` namespace: questionnaire content
 * is authored in the FHIR Questionnaire and supplied to the renderer as the English
 * `defaultValue`, so those keys exist only in es.json (their coverage is enforced separately by
 * questionnaire-translation-coverage.test.ts). They are excluded from the chrome parity checks
 * here, and asserted to be absent from en.json.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EN_PATH = path.resolve(__dirname, '../../src/lib/i18n-en.json');
const ES_PATH = path.resolve(__dirname, '../../src/lib/i18n-es.json');
const QUESTIONNAIRE_PREFIX = 'questionnaire.';

const flattenKeys = (obj: Record<string, unknown>, prefix = '', out = new Set<string>()): Set<string> => {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const full = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flattenKeys(value as Record<string, unknown>, full, out);
    } else {
      out.add(full);
    }
  }
  return out;
};

const chromeKeys = (keys: Set<string>): string[] => [...keys].filter((k) => !k.startsWith(QUESTIONNAIRE_PREFIX));

describe('intake i18n en/es key parity', () => {
  const enKeys = flattenKeys(JSON.parse(fs.readFileSync(EN_PATH, 'utf8')));
  const esKeys = flattenKeys(JSON.parse(fs.readFileSync(ES_PATH, 'utf8')));

  it('has a Spanish counterpart for every English chrome key', () => {
    const missingInEs = chromeKeys(enKeys)
      .filter((k) => !esKeys.has(k))
      .sort();
    expect(missingInEs, `English keys with no es.json counterpart:\n${missingInEs.join('\n')}`).toEqual([]);
  });

  it('has an English counterpart for every Spanish chrome key', () => {
    const missingInEn = chromeKeys(esKeys)
      .filter((k) => !enKeys.has(k))
      .sort();
    expect(missingInEn, `Spanish keys with no en.json counterpart:\n${missingInEn.join('\n')}`).toEqual([]);
  });

  it('keeps questionnaire.* keys out of en.json (English comes from the FHIR defaultValue)', () => {
    const questionnaireInEn = [...enKeys].filter((k) => k.startsWith(QUESTIONNAIRE_PREFIX)).sort();
    expect(questionnaireInEn, `Unexpected questionnaire.* keys in en.json:\n${questionnaireInEn.join('\n')}`).toEqual(
      []
    );
  });
});
