import { useMemo } from 'react';
import { getRosFindingFieldKeys } from 'utils/lib/ottehr-config/review-of-systems';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { TEMPLATE_SECTION_DEFAULT_ACTIONS, TemplateSectionKey } from 'utils/lib/types/data/apply-template.types';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { normalizeName } from './scribeSections';
import { ScribeRecommendation, TemplateRecommendation } from './types';

/**
 * Which visit-note items the scribe panel wrote. The chart doesn't record authorship, so an item counts as AI
 * added when an applied recommendation matches it by the `isAlreadyCharted` rule. Session state only.
 */

/**
 * Recommendations the panel has written into this visit's chart during this sitting. The session belongs to
 * the visit it was started on, so another visit's note shows none of its marks.
 */
export const useAiAddedRecommendations = (): ScribeRecommendation[] => {
  const { encounter } = useAppointmentData();
  const sessionEncounterId = useScribeRecommendationsStore((state) => state.encounterId);
  const recommendations = useScribeRecommendationsStore((state) => state.recommendations);
  const itemState = useScribeRecommendationsStore((state) => state.itemState);
  return useMemo(
    () =>
      sessionEncounterId && sessionEncounterId === encounter?.id
        ? recommendations.filter((rec) => itemState[rec.id]?.status === 'applied')
        : [],
    [sessionEncounterId, encounter?.id, recommendations, itemState]
  );
};

/** A chart item as the note renders it, in the terms the matching rules need. */
export type AiAddedTarget =
  | { kind: 'allergy'; name: string | undefined }
  | { kind: 'medication'; name: string | undefined }
  | { kind: 'diagnosis'; code: string | undefined }
  /** A ROS field key as the ROS table keys it (the reports or denies key, not the base key). */
  | { kind: 'ros'; fieldKey: string }
  | { kind: 'vital-weight' }
  /** The whole HPI text on the note; matches when it contains what the panel appended. */
  | { kind: 'hpi'; text: string | undefined }
  | { kind: 'template' };

/** The applied recommendation that wrote this chart item, or undefined if the provider did. */
export const findAiAddedFor = (
  applied: ScribeRecommendation[],
  target: AiAddedTarget
): ScribeRecommendation | undefined =>
  applied.find((rec) => {
    switch (target.kind) {
      case 'allergy':
        return rec.kind === 'allergy' && normalizeName(rec.name) === normalizeName(target.name);
      case 'medication':
        return rec.kind === 'medication' && normalizeName(rec.name) === normalizeName(target.name);
      case 'diagnosis':
        return rec.kind === 'diagnosis' && rec.code === target.code;
      case 'ros': {
        if (rec.kind !== 'ros') return false;
        const { deniesKey, reportsKey } = getRosFindingFieldKeys(rec.baseKey);
        return (rec.finding === RosFindingState.Reports ? reportsKey : deniesKey) === target.fieldKey;
      }
      // The panel only writes a weight when the encounter has none, so any weight entry is its.
      case 'vital-weight':
        return rec.kind === 'vital-weight';
      case 'hpi':
        return (
          rec.kind === 'hpi' &&
          (rec.field ?? 'historyOfPresentIllness') === 'historyOfPresentIllness' &&
          rec.text.trim().length > 0 &&
          (target.text ?? '').includes(rec.text.trim())
        );
      case 'template':
        return rec.kind === 'template';
    }
  });

/** The template sections each visit-note card shows, which decide whether the card gets the template badge. */
export const TEMPLATE_SECTIONS_BY_CARD = {
  examination: ['examFindings'],
  assessment: ['mdm', 'diagnoses', 'emCode', 'cptCodes'],
  plan: ['patientInstructions'],
} as const satisfies Record<string, readonly TemplateSectionKey[]>;

export type TemplateBadgeCard = keyof typeof TEMPLATE_SECTIONS_BY_CARD;

/**
 * Whether the applied template wrote into this card: at least one of the sections the card shows was not
 * skipped in the apply dialog. A section the dialog did not set took its default action, which is never skip.
 */
export const templateFilledCard = (template: TemplateRecommendation, card: TemplateBadgeCard): boolean =>
  TEMPLATE_SECTIONS_BY_CARD[card].some(
    (section) => (template.sectionActions?.[section] ?? TEMPLATE_SECTION_DEFAULT_ACTIONS[section]) !== 'skip'
  );
