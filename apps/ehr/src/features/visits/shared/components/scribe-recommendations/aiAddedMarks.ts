import { useMemo } from 'react';
import { getRosFindingFieldKeys } from 'utils/lib/ottehr-config/review-of-systems';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { ScribeRecommendation } from './types';

/**
 * Which items on the visit note the scribe panel put there. The chart does not record who wrote
 * an item, so the note asks the panel: a chart item is "AI added" when an applied recommendation
 * matches it by the same rule the panel uses to spot a duplicate (`isAlreadyCharted`). Session
 * state only — a reload forgets, as the panel does.
 */

const normalize = (value: string | undefined): string => (value ?? '').trim().toLowerCase();

/** Recommendations the panel has written into the chart during this sitting. */
export const useAiAddedRecommendations = (): ScribeRecommendation[] => {
  const recommendations = useScribeRecommendationsStore((state) => state.recommendations);
  const itemState = useScribeRecommendationsStore((state) => state.itemState);
  return useMemo(
    () => recommendations.filter((rec) => itemState[rec.id]?.status === 'applied'),
    [recommendations, itemState]
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
        return rec.kind === 'allergy' && normalize(rec.name) === normalize(target.name);
      case 'medication':
        return rec.kind === 'medication' && normalize(rec.name) === normalize(target.name);
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
        return rec.kind === 'hpi' && rec.text.trim().length > 0 && (target.text ?? '').includes(rec.text.trim());
      case 'template':
        return rec.kind === 'template';
    }
  });
