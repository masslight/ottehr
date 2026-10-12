import { ExamObservationDTO } from '../../types/api/chart-data/chart-data.types';
import { InPersonRosConfig, RosFindingState, RosItemSuffixes } from './in-person.config';

export const rosField = (base: string, finding: RosFindingState): string => `${base}${RosItemSuffixes[finding]}`;

export const getRosFindingFieldKeys = (baseKey: string): { deniesKey: string; reportsKey: string } => {
  return {
    deniesKey: rosField(baseKey, RosFindingState.Denies),
    reportsKey: rosField(baseKey, RosFindingState.Reports),
  };
};

export const getRosFindingStateFromKey = (key: string): RosFindingState | undefined => {
  if (key.endsWith(RosItemSuffixes[RosFindingState.Reports])) {
    return RosFindingState.Reports;
  }

  if (key.endsWith(RosItemSuffixes[RosFindingState.Denies])) {
    return RosFindingState.Denies;
  }

  return undefined;
};

/** Whether a ROS observation holds a checked finding or a comment. */
export const isRosObservationSet = (observation: ExamObservationDTO | undefined): boolean =>
  observation?.value === true || !!observation?.note?.trim();

export const getRosCommentFieldKey = (systemKey: string): string => `ros-${systemKey}-comment`;

export const ROS_COMMENT_FIELD_KEYS: string[] = Object.keys(InPersonRosConfig).map(getRosCommentFieldKey);

export const getRosSystemKeyForCommentField = (field: string): string | undefined =>
  Object.keys(InPersonRosConfig).find((systemKey) => getRosCommentFieldKey(systemKey) === field);

/** Collect all known ROS field keys from the config (-denies and -reports variants, plus each system's comment) */
export function collectKnownRosFields(): Set<string> {
  const fields = new Set<string>(ROS_COMMENT_FIELD_KEYS);
  for (const system of Object.values(InPersonRosConfig)) {
    for (const baseKey of Object.keys(system.items)) {
      const { deniesKey, reportsKey } = getRosFindingFieldKeys(baseKey);
      fields.add(deniesKey);
      fields.add(reportsKey);
    }
  }
  return fields;
}
