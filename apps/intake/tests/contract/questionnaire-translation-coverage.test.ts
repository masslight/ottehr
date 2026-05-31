import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectBookingQuestionnaire } from 'utils/lib/ottehr-config/booking';
import { IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE } from 'utils/lib/ottehr-config/intake-paperwork';
import { VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE } from 'utils/lib/ottehr-config/intake-paperwork-virtual';
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
 * Sources of truth (core Ottehr defaults): the current questionnaires GENERATED from config
 * — not the versioned archives in config/oystehr. The archives accumulate historical
 * versions; the live questionnaire is whatever the generator produces from the current
 * config, exactly like the booking questionnaire. So we generate all three here:
 *   - booking/registration  -> selectBookingQuestionnaire()
 *   - in-person paperwork    -> IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE()
 *   - virtual paperwork      -> VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE()
 *
 * Per-instance questionnaires (e.g. config-driven reason-for-visit options) are out of scope;
 * they ship their own content and need their own translations.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ES_PATH = path.resolve(__dirname, '../../src/lib/i18n-es.json');

const EXTENSION_SUFFIX: Record<string, string> = {
  'https://fhir.zapehr.com/r4/StructureDefinitions/information-text': 'infoText',
  'https://fhir.zapehr.com/r4/StructureDefinitions/information-text-secondary': 'secondaryInfoText',
  'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text': 'attachmentText',
};

/**
 * Hidden/internal questionnaire fields that are never shown to a patient as readable copy
 * (pharmacy-autocomplete plumbing), so they intentionally fall back to English. Keep this
 * list tight and documented — the `does not contain a stale allowlist entry` test below
 * fails if an allowlisted key is no longer produced by the questionnaires.
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
  const questionnaires = [
    selectBookingQuestionnaire().templateQuestionnaire,
    IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE(),
    VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE(),
  ];
  for (const q of questionnaires) {
    collectExpectedKeys(q.item as Item[], expected);
  }
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
