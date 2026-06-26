import { Location } from 'fhir/r4b';

/**
 * Render a Location id as "<Name> (inactive)" when its FHIR status is
 * inactive, or "<Name>" otherwise. Falls back to the raw id when the
 * Location isn't in the supplied list — that's the genuine "unknown" case
 * (resource was hard-deleted, or never fetched) and surfacing the id is
 * preferable to a silently-empty label.
 *
 * One home for the suffix convention so the provider-schedule Location
 * selector (SchedulePage), the Group Locations multi-select chip, and the
 * Group provider-coverage rollup (GroupPage) all read identically. Adding a
 * new surface that mentions a Location? Use this helper rather than inlining
 * a fourth ternary.
 */
export function formatLocationLabel(locations: Location[], id: string): string {
  const hit = locations.find((l) => l.id === id);
  if (!hit) return id;
  const base = hit.name || id;
  return hit.status === 'inactive' ? `${base} (inactive)` : base;
}
