import { QuestionnaireDataTypes } from 'config-types';
import { Questionnaire, QuestionnaireItem } from 'fhir/r4b';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from '../../fhir/constants';
import { bumpKind, isSemver, SemverBumpKind } from '../semver';
import { harvestRegressions } from './harvest-invariants';

/**
 * FHIR item.type values the paperwork engine can render (`getInputTypeForItem`). Any other type falls
 * through to an empty render and throws when the validation schema is built.
 */
const SUPPORTED_ITEM_TYPES: ReadonlySet<string> = new Set([
  'group',
  'display',
  'string',
  'text',
  'decimal',
  'boolean',
  'choice',
  'open-choice',
  'date',
  'attachment',
]);

// Enumerated string values the engine accepts for its item-level extensions. An out-of-enum value is
// silently dropped by the engine (a latent form bug), so we surface it as a hard error on import.
const ENUM_EXTENSION_ALLOWED_VALUES: Record<string, readonly string[]> = {
  [OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.dataType]: QuestionnaireDataTypes,
  [OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.groupType]: [
    'list-with-form',
    'gray-contained-widget',
    'credit-card-collection',
    'pharmacy-collection',
  ],
  [OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.inputWidth]: ['s', 'm', 'l', 'max'],
  [OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.preferredElement]: [
    'Radio',
    'Radio List',
    'Select',
    'Free Select',
    'Button',
    'Link',
    'p',
    'h3',
    'h4',
    'h5',
  ],
  [OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.disabledDisplay]: ['hidden', 'protected'],
};

const ANSWER_LOADING_OPTIONS_URL = OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.answerLoadingOptions.extension;

export interface SystemManagedImportValidationSuccess {
  ok: true;
  imported: Questionnaire;
  bump: SemverBumpKind;
}
export interface SystemManagedImportValidationFailure {
  ok: false;
  errors: string[];
}
export type SystemManagedImportValidationResult =
  | SystemManagedImportValidationSuccess
  | SystemManagedImportValidationFailure;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Flattens the whole item tree into a single array (depth-first, parents before children). */
const collectAllItems = (
  items: QuestionnaireItem[] | undefined,
  acc: QuestionnaireItem[] = []
): QuestionnaireItem[] => {
  for (const item of items ?? []) {
    acc.push(item);
    if (item.item) collectAllItems(item.item, acc);
  }
  return acc;
};

const choiceHasOptions = (item: QuestionnaireItem): boolean => {
  if (Array.isArray(item.answerOption) && item.answerOption.length > 0) return true;
  if (item.answerValueSet) return true;
  return Boolean(item.extension?.some((ext) => ext.url === ANSWER_LOADING_OPTIONS_URL));
};

const answerOptionHasValue = (option: NonNullable<QuestionnaireItem['answerOption']>[number]): boolean =>
  option.valueString !== undefined || option.valueCoding !== undefined || option.valueInteger !== undefined;

/**
 * Validates a candidate next-version FHIR Questionnaire for a system-managed form. Runs three tiers and
 * collects every failure so the user sees the full picture at once:
 *   1. basic identity / versioning (resourceType, status draft, url match, optional id match, semver bump)
 *   2. paperwork-engine renderability (page/item structure the engine assumes)
 *   3. harvest-module regression (differential vs the current active version)
 *
 * Any failure hard-blocks the import (`ok: false`), per product decision — this is an intentional
 * baseline meant to be tightened/relaxed iteratively.
 */
export function validateSystemManagedImport(input: {
  imported: unknown;
  current: Questionnaire;
}): SystemManagedImportValidationResult {
  const { imported, current } = input;
  const errors: string[] = [];

  if (!isRecord(imported)) {
    return { ok: false, errors: ['Imported content is not a JSON object.'] };
  }

  // ---- Tier 1: basic identity / versioning ----
  if (imported.resourceType !== 'Questionnaire') {
    errors.push(`resourceType must be "Questionnaire" (got ${JSON.stringify(imported.resourceType)}).`);
  }
  if (imported.status !== 'draft') {
    errors.push(`status must be "draft" (got ${JSON.stringify(imported.status)}).`);
  }
  if (imported.url !== current.url) {
    errors.push(
      `url must exactly match the current form's url "${current.url}" (got ${JSON.stringify(imported.url)}).`
    );
  }
  if (imported.id != null && imported.id !== current.id) {
    errors.push(
      `id, when present, must match the current form's id "${current.id}" (got ${JSON.stringify(imported.id)}).`
    );
  }

  const importedVersion = imported.version;
  if (!isSemver(importedVersion)) {
    errors.push(`version must be semver (major.minor.patch), got ${JSON.stringify(importedVersion)}.`);
  } else if (!isSemver(current.version)) {
    errors.push(`Cannot compare versions: the current form has no valid semver version ("${current.version}").`);
  } else if (bumpKind(current.version, importedVersion) === null) {
    errors.push(
      `version "${importedVersion}" must be a semver increase over the current version "${current.version}" (major, minor, or patch).`
    );
  }

  const bump =
    isSemver(importedVersion) && isSemver(current.version) ? bumpKind(current.version, importedVersion) : null;

  // The remaining tiers assume a Questionnaire shape with an item array. Bail if the basics preclude it.
  const items = imported.item;
  if (imported.resourceType !== 'Questionnaire' || !Array.isArray(items)) {
    if (Array.isArray(items) === false && imported.resourceType === 'Questionnaire') {
      errors.push('Questionnaire must have a non-empty item array (top-level pages).');
    }
    return { ok: false, errors };
  }

  const questionnaire = imported as unknown as Questionnaire;

  // ---- Tier 2: paperwork-engine renderability ----
  if (items.length === 0) {
    errors.push('Questionnaire must have at least one top-level page (item).');
  }

  const allItems = collectAllItems(questionnaire.item);

  // linkId presence + global uniqueness
  const seenLinkIds = new Set<string>();
  for (const item of allItems) {
    if (!item.linkId) {
      errors.push(`Every item must have a linkId (found a ${item.type ?? 'unknown'} item without one).`);
      continue;
    }
    if (seenLinkIds.has(item.linkId)) {
      errors.push(`Duplicate linkId "${item.linkId}". linkIds must be unique across the whole questionnaire.`);
    }
    seenLinkIds.add(item.linkId);
  }

  // top-level items must be pages (groups with children); page slugs unique after stripping trailing -page
  const pageSlugs = new Set<string>();
  for (const page of questionnaire.item ?? []) {
    if (page.type !== 'group') {
      errors.push(`Top-level item "${page.linkId ?? '(no linkId)'}" must be a group (a page).`);
    } else if (!page.item || page.item.length === 0) {
      errors.push(`Page "${page.linkId ?? '(no linkId)'}" must contain at least one item.`);
    }
    if (page.linkId) {
      const slug = page.linkId.replace(/-page$/, '');
      if (pageSlugs.has(slug)) {
        errors.push(`Page linkId "${page.linkId}" collides with another page after removing the "-page" suffix.`);
      }
      pageSlugs.add(slug);
    }
  }

  // per-item type / options / extension checks
  for (const item of allItems) {
    const label = item.linkId ?? `(${item.type ?? 'unknown'})`;

    if (item.type && !SUPPORTED_ITEM_TYPES.has(item.type)) {
      errors.push(
        `Item "${label}" has unsupported type "${item.type}". The paperwork engine supports: ${[
          ...SUPPORTED_ITEM_TYPES,
        ].join(', ')}.`
      );
    }

    if (item.type === 'choice' || item.type === 'open-choice') {
      if (!choiceHasOptions(item)) {
        errors.push(
          `Choice item "${label}" has no options. It needs answerOption, answerValueSet, or an answer-loading-options extension, or the form will crash on render.`
        );
      }
      (item.answerOption ?? []).forEach((option, i) => {
        if (!answerOptionHasValue(option)) {
          errors.push(`answerOption[${i}] on "${label}" has no value (expected valueString/valueCoding/valueInteger).`);
        }
      });
    }

    for (const ext of item.extension ?? []) {
      const allowed = ENUM_EXTENSION_ALLOWED_VALUES[ext.url];
      if (allowed && ext.valueString !== undefined && !allowed.includes(ext.valueString)) {
        errors.push(
          `Item "${label}" has extension ${ext.url} with invalid value "${ext.valueString}". Allowed: ${allowed.join(
            ', '
          )}.`
        );
      }
    }
  }

  // enableWhen questions must resolve to a real linkId (or the $status sentinel)
  for (const item of allItems) {
    for (const condition of item.enableWhen ?? []) {
      const question = condition.question;
      if (!question) {
        errors.push(`Item "${item.linkId ?? '(no linkId)'}" has an enableWhen with no question.`);
        continue;
      }
      if (question === '$status') continue;
      const head = question.split('.')[0];
      if (!seenLinkIds.has(question) && !seenLinkIds.has(head)) {
        errors.push(
          `enableWhen on "${
            item.linkId ?? '(no linkId)'
          }" references unknown question "${question}". It must match a linkId in this questionnaire or "$status".`
        );
      }
    }
  }

  // ---- Tier 3: harvest-module regression (differential vs current active) ----
  errors.push(...harvestRegressions(current, questionnaire));

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, imported: questionnaire, bump: bump as SemverBumpKind };
}
