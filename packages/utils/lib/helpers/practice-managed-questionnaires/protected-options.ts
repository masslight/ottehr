import { cloneDeep } from 'lodash-es';
import {
  HARVEST_LOCK_MANIFEST,
  HarvestLockManifest,
  resolveLocksForQuestionnaire,
} from '../../ottehr-config/harvest-lock-manifest';
import {
  PracticeManagedQuestionnaire,
  PracticeManagedQuestionnaireItem,
} from '../../types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';

const codeToCodingOptions = (item: PracticeManagedQuestionnaireItem, protectedCodes: Set<string>): void => {
  if (!item.answerOption) return;
  item.answerOption = item.answerOption.map((option) => {
    // already coded — leave it (its display may have been edited, code stays frozen)
    if (option.valueCoding) return option;
    const value = option.valueString;
    if (value !== undefined && protectedCodes.has(value)) {
      // freeze the harvested value as the code; seed display from the current label
      return { valueCoding: { code: value, display: value } };
    }
    return option;
  });
};

const walk = (
  items: PracticeManagedQuestionnaireItem[] | undefined,
  protectedByLinkId: Map<string, Set<string>>
): void => {
  for (const item of items ?? []) {
    const protectedCodes = item.linkId ? protectedByLinkId.get(item.linkId) : undefined;
    if (protectedCodes) codeToCodingOptions(item, protectedCodes);
    walk(item.item, protectedByLinkId);
  }
};

/**
 * Normalize a questionnaire's harvest-protected answer options to the `valueCoding` shape
 * (`{code: value, display: value}`), so their harvested `code` is frozen while the `display` label stays
 * editable. Options that are already `valueCoding`, and any non-protected options, are left untouched.
 * Returns a deep clone; the input is not mutated.
 *
 * Use it when loading a `practice-default` questionnaire that still stores protected options as plain
 * `valueString`, and on save from the builder so a first edit locks the codes going forward.
 */
export const applyProtectedOptionCoding = (
  questionnaire: PracticeManagedQuestionnaire,
  manifest: HarvestLockManifest = HARVEST_LOCK_MANIFEST
): PracticeManagedQuestionnaire => {
  const locks = resolveLocksForQuestionnaire(questionnaire, manifest);
  if (locks.protectedOptionCodesByLinkId.size === 0) return questionnaire;

  const next = cloneDeep(questionnaire);
  walk(next.item, locks.protectedOptionCodesByLinkId);
  return next;
};
