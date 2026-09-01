import { Questionnaire } from 'fhir/r4b';
import { SYSTEM_MANAGED_QUESTIONNAIRE_TAG } from '../../fhir/constants';

/** True when the Questionnaire carries the system-managed meta.tag. */
export function isSystemManagedQ(q: Questionnaire | undefined): boolean {
  if (!q) return false;
  const { system, code } = SYSTEM_MANAGED_QUESTIONNAIRE_TAG;
  return Boolean(q.meta?.tag?.some((t) => t.system === system && t.code === code));
}

/**
 * Returns a copy of the Questionnaire guaranteed to carry the system-managed meta.tag exactly once.
 * Other tags are preserved.
 */
export function ensureSystemManagedTag(questionnaire: Questionnaire): Questionnaire {
  if (isSystemManagedQ(questionnaire)) return questionnaire;

  const existingMeta = questionnaire.meta ?? {};
  const existingTags = existingMeta.tag ?? [];

  return {
    ...questionnaire,
    meta: {
      ...existingMeta,
      tag: [...existingTags, SYSTEM_MANAGED_QUESTIONNAIRE_TAG],
    },
  };
}
