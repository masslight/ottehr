import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectBookingQuestionnaire } from 'utils/lib/ottehr-config/booking';
import { describe, expect, it } from 'vitest';

/**
 * Contract test: every English string the patient-facing questionnaires render must
 * have a Spanish translation in i18n-es.json.
 *
 * The renderer (PagedQuestionnaire + the answer-option components) resolves questionnaire
 * content through `t('questionnaire.<linkId>[.<suffix>]', { defaultValue: <english> })`
 * with i18next key/namespace separators disabled, so each lookup is a single flat key in
 * the translation resource. This test reconstructs the expected set of those keys from the
 * canonical sources of truth and asserts es.json covers them.
 *
 * Sources of truth (core Ottehr defaults):
 *   - the in-person and virtual intake paperwork Questionnaire archives (latest version), and
 *   - the booking/registration Questionnaire produced by selectBookingQuestionnaire().
 *
 * Per-instance questionnaires (e.g. config-driven reason-for-visit options) are out of scope;
 * they ship their own content and need their own translations.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');
const ES_PATH = path.resolve(__dirname, '../../src/lib/i18n-es.json');
const ARCHIVES = [
  'config/oystehr/in-person-intake-questionnaire-archive.json',
  'config/oystehr/virtual-intake-questionnaire-archive.json',
];

const EXTENSION_SUFFIX: Record<string, string> = {
  'https://fhir.zapehr.com/r4/StructureDefinitions/information-text': 'infoText',
  'https://fhir.zapehr.com/r4/StructureDefinitions/information-text-secondary': 'secondaryInfoText',
  'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text': 'attachmentText',
};

/**
 * Hidden/internal questionnaire fields that are never shown to a patient as readable copy
 * (pharmacy-autocomplete plumbing), so they intentionally fall back to English. Keep this
 * list tight and documented — see the `expectedKeys` membership assertion below, which fails
 * if an allowlisted key is no longer produced by the questionnaires (stale allowlist).
 */
const ALLOWLIST = new Set<string>([
  'questionnaire.pharmacy-places-id',
  'questionnaire.pharmacy-places-name',
  'questionnaire.pharmacy-places-address',
  'questionnaire.pharmacy-places-saved',
  'questionnaire.erx-pharmacy-id',
]);

type Item = {
  linkId?: string;
  text?: string;
  extension?: { url: string; valueString?: string }[];
  answerOption?: { valueString?: string; valueCoding?: { display?: string } }[];
  item?: Item[];
};

const compareVersion = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
};

const latestQuestionnaireFromArchive = (relPath: string): { item?: Item[] } => {
  const raw = JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
  const questionnaires = Object.values(raw.fhirResources)
    .map((entry: any) => entry.resource ?? entry)
    .filter((r: any) => r.resourceType === 'Questionnaire');
  questionnaires.sort((a: any, b: any) => compareVersion(a.version, b.version));
  return questionnaires[questionnaires.length - 1];
};

// Mirror of getQuestionnaireText key construction, kept in sync with the renderer.
const collectExpectedKeys = (items: Item[] | undefined, out: Map<string, string>): void => {
  for (const item of items ?? []) {
    const { linkId } = item;
    if (linkId == null) continue;
    if (item.text) out.set(`questionnaire.${linkId}`, item.text);
    for (const ext of item.extension ?? []) {
      const suffix = EXTENSION_SUFFIX[ext.url];
      if (suffix && ext.valueString) out.set(`questionnaire.${linkId}.${suffix}`, ext.valueString);
    }
    for (const option of item.answerOption ?? []) {
      const value = option.valueString ?? option.valueCoding?.display;
      if (value) out.set(`questionnaire.${linkId}.option.${value}`, value);
    }
    collectExpectedKeys(item.item, out);
  }
};

const buildExpectedKeys = (): Map<string, string> => {
  const expected = new Map<string, string>();
  for (const archive of ARCHIVES) {
    collectExpectedKeys(latestQuestionnaireFromArchive(archive).item, expected);
  }
  collectExpectedKeys(selectBookingQuestionnaire().templateQuestionnaire.item as Item[], expected);
  return expected;
};

describe('questionnaire Spanish translation coverage', () => {
  const expected = buildExpectedKeys();
  const es = JSON.parse(fs.readFileSync(ES_PATH, 'utf8')) as Record<string, unknown>;

  it('extracts a non-trivial set of questionnaire keys (extraction sanity check)', () => {
    expect(expected.size).toBeGreaterThan(500);
  });

  it('has a Spanish translation for every English questionnaire string (except the documented allowlist)', () => {
    const missing: string[] = [];
    for (const [key, english] of expected) {
      if (ALLOWLIST.has(key)) continue;
      const value = es[key];
      if (typeof value !== 'string' || value.length === 0) {
        missing.push(`${key}  (en: ${JSON.stringify(english)})`);
      }
    }
    expect(missing, `Missing Spanish for ${missing.length} questionnaire key(s):\n${missing.join('\n')}`).toEqual([]);
  });

  it('does not contain a stale allowlist entry', () => {
    const stale = [...ALLOWLIST].filter((key) => !expected.has(key));
    expect(stale, `Allowlisted keys no longer produced by any questionnaire:\n${stale.join('\n')}`).toEqual([]);
  });
});
