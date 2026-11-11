import { getRulesData, RulesData } from './data/rules-data';
import { FORECAST_GROUPS } from './groups';
import { ImmunizationGroupId } from './types';

/**
 * Every CVX code in the rules data → the forecast lanes it gives an antigen of (Pentacel, CVX 120, → dtap, hib,
 * ipv). The Due today box reads it to know what a stocked vaccine covers beyond what is due; a lane split in two
 * (pcv / pneumo-adult, rsv / rsv-adult) lists both, and the caller keeps the one the forecast returned.
 */
export function cvxToGroups(rules: RulesData = getRulesData()): Record<string, ImmunizationGroupId[]> {
  const groupsByAntigen = new Map<string, ImmunizationGroupId[]>();
  for (const group of FORECAST_GROUPS) {
    for (const antigen of rules.vaccineGroupAntigens.get(group.vaccineGroup) ?? []) {
      groupsByAntigen.set(antigen, [...(groupsByAntigen.get(antigen) ?? []), group.id]);
    }
  }
  const result: Record<string, ImmunizationGroupId[]> = {};
  for (const [cvx, entry] of rules.cvxMap) {
    const groups = new Set<ImmunizationGroupId>();
    for (const association of entry.associations) {
      for (const group of groupsByAntigen.get(association.antigen) ?? []) groups.add(group);
    }
    if (groups.size) result[cvx] = [...groups];
  }
  return result;
}
