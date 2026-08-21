import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import {
  HARVEST_LOCK_MANIFEST,
  HarvestLockManifest,
  resolveLocksForQuestionnaire,
} from '../../ottehr-config/harvest-lock-manifest';
import {
  PracticeManagedQuestionnaire,
  PracticeManagedQuestionnaireItem,
} from '../../types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';

// the harvested value of an answer option is its coded `code` when present, else the raw `valueString`
const optionCode = (option: QuestionnaireItemAnswerOption): string | undefined =>
  option.valueCoding?.code ?? option.valueString;

interface FlatItem {
  item: PracticeManagedQuestionnaireItem;
  isTopLevel: boolean;
}

const flattenByLinkId = (
  items: PracticeManagedQuestionnaireItem[] | undefined,
  isTopLevel: boolean,
  acc: Map<string, FlatItem>
): void => {
  for (const item of items ?? []) {
    if (item.linkId) acc.set(item.linkId, { item, isTopLevel });
    flattenByLinkId(item.item, false, acc);
  }
};

/**
 * Validate an edited `practice-default` questionnaire against the harvest-lock manifest.
 *
 * Compares the `submitted` questionnaire against the `base` (current stored version): a harvest-critical
 * (locked) item may have its display text / help text reworded, but must not be removed, renamed (its
 * linkId changed → seen as removed), retyped, or have its `required` flipped; a harvest-critical page must
 * not be removed; and a protected option's frozen `code` must not be removed or changed (its `display` is
 * free to change). Returns a list of human-readable violation messages — empty means the edit is allowed.
 *
 * Pure and side-effect free: reused client-side (pre-save guard) and server-side (anti-tamper — the server
 * recomputes locks from the manifest and ignores any client-supplied hints).
 */
export const validateEditsAgainstLocks = (
  submitted: Pick<PracticeManagedQuestionnaire, 'item'>,
  base: Pick<PracticeManagedQuestionnaire, 'item'>,
  manifest: HarvestLockManifest = HARVEST_LOCK_MANIFEST
): string[] => {
  const locks = resolveLocksForQuestionnaire(base, manifest);
  const violations: string[] = [];

  const baseItems = new Map<string, FlatItem>();
  flattenByLinkId(base.item, true, baseItems);
  const submittedItems = new Map<string, FlatItem>();
  flattenByLinkId(submitted.item, true, submittedItems);

  // locked pages (top-level harvested groups) must not be removed
  for (const [linkId, { isTopLevel }] of baseItems) {
    if (!isTopLevel || !locks.lockedPageLinkIds.has(linkId)) continue;
    if (!submittedItems.has(linkId)) {
      violations.push(`Harvested page "${linkId}" cannot be removed.`);
    }
  }

  // locked items must survive with an unchanged type/required; protected option codes must stay frozen
  for (const linkId of locks.lockedItemLinkIds) {
    const baseEntry = baseItems.get(linkId);
    if (!baseEntry) continue; // manifest lists a linkId this questionnaire doesn't use — nothing to lock

    const submittedEntry = submittedItems.get(linkId);
    if (!submittedEntry) {
      violations.push(`Harvested field "${linkId}" cannot be removed or renamed.`);
      continue;
    }

    if (submittedEntry.item.type !== baseEntry.item.type) {
      violations.push(`Harvested field "${linkId}" cannot change type.`);
    }
    if (Boolean(submittedEntry.item.required) !== Boolean(baseEntry.item.required)) {
      violations.push(`Harvested field "${linkId}" cannot change whether it is required.`);
    }

    const protectedCodes = locks.protectedOptionCodesByLinkId.get(linkId);
    if (protectedCodes && protectedCodes.size > 0) {
      const submittedCodes = new Set(
        (submittedEntry.item.answerOption ?? []).map(optionCode).filter((c): c is string => c !== undefined)
      );
      for (const code of protectedCodes) {
        if (!submittedCodes.has(code)) {
          violations.push(`Protected answer "${code}" on field "${linkId}" cannot be removed or changed.`);
        }
      }
    }
  }

  return violations;
};
