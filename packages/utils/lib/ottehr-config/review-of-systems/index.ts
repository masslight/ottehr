import { InPersonRosConfig, RosFindingState, RosItemSuffixes } from './in-person.config';
export { InPersonRosConfig, RosFindingState, RosFindingStateLabel } from './in-person.config';
export type { RosCard, RosCardItem, RosItemConfig } from './in-person.config';

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

/** Collect all known ROS field keys from the config (includes -denies and -reports variants) */
export function collectKnownRosFields(): Set<string> {
  const fields = new Set<string>();
  for (const system of Object.values(InPersonRosConfig)) {
    for (const baseKey of Object.keys(system.items)) {
      const { deniesKey, reportsKey } = getRosFindingFieldKeys(baseKey);
      fields.add(deniesKey);
      fields.add(reportsKey);
    }
  }
  return fields;
}
