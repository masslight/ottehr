import { InPersonRosConfig, RosFinding, RosItemSuffixes } from './in-person.config';
export { InPersonRosConfig } from './in-person.config';
export type { RosCard, RosCardItem, RosItemConfig } from './in-person.config';

export const rosField = (base: string, finding: RosFinding): string => `${base}${RosItemSuffixes[finding]}`;

export const getRosFindingFieldKeys = (baseKey: string): { deniesKey: string; reportsKey: string } => {
  return {
    deniesKey: rosField(baseKey, RosFinding.Denies),
    reportsKey: rosField(baseKey, RosFinding.Reports),
  };
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
