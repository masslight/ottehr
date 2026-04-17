export { InPersonRosConfig } from './in-person.config';
export type { RosCard, RosCardItem, RosItemConfig } from './in-person.config';

/** Collect all known ROS field keys from the config */
export function collectKnownRosFields(): Set<string> {
  const fields = new Set<string>();
  for (const system of Object.values(InPersonRosConfig)) {
    for (const fieldKey of Object.keys(system.items)) {
      fields.add(fieldKey);
    }
  }
  return fields;
}
