import { HealthcareService } from 'fhir/r4b';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';

// Subset of the catalog entry shape that hydration actually reads. Kept
// permissive so callers can pass their richer types without conversion.
// `source` discriminates the two flavors of category in the merged catalog
// (BOOKING_CONFIG vs FHIR-managed) — required so the hook can drop the
// BOOKING_CONFIG flavor, which groups can't legitimately cover.
export interface SupportedCategoryCatalogEntry {
  code: string;
  source: 'booking-config' | 'fhir';
}

/**
 * Hydrates the group's stored `type[]` codes into the multi-select keying
 * shape the UI uses — FHIR HealthcareService ids. BOOKING_CONFIG entries are
 * intentionally dropped: groups reference categories by FHIR id, and a
 * BOOKING_CONFIG (compile-time) category has no HS to reference. Any
 * BOOKING_CONFIG codes that historical bad data left in `group.type[]` are
 * silently filtered out here; saving the group after edit will then write
 * back a clean type[]. Idempotent per group — once hydrated for a given
 * `group.id`, the returned setter takes over so user edits aren't clobbered.
 * When `group.id` changes (e.g., navigating to a different group in the same
 * mounted component), hydration runs again for the new group.
 *
 * The `categoryDataLoaded` flag is the *real* guard. The catalog map can
 * appear populated on the first render because BOOKING_CONFIG entries are
 * compiled in; gating on `map.size > 0` would lie and hydrate against a
 * partial map, dropping any FHIR-managed codes that arrive later.
 */
export function useHydratedSupportedCategoryHsIds(
  group: HealthcareService | undefined,
  categoryByHsId: ReadonlyMap<string, SupportedCategoryCatalogEntry>,
  categoryDataLoaded: boolean
): [string[], Dispatch<SetStateAction<string[]>>] {
  const [supportedCategoryHsIds, setSupportedCategoryHsIds] = useState<string[]>([]);
  // Stores the `group.id` we've hydrated state for. `undefined` = not yet;
  // re-runs when the value changes so navigating between groups re-hydrates.
  const hydratedForGroupIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!group || !categoryDataLoaded) return;
    if (hydratedForGroupIdRef.current === group.id) return;

    const codes = new Set<string>();
    for (const t of group.type ?? []) {
      for (const c of t.coding ?? []) {
        if (c.code) codes.add(c.code);
      }
    }

    const allowed: string[] = [];
    for (const [id, info] of categoryByHsId.entries()) {
      if (info.source !== 'fhir') continue;
      if (codes.has(info.code)) allowed.push(id);
    }
    setSupportedCategoryHsIds(allowed);
    hydratedForGroupIdRef.current = group.id;
  }, [group, categoryByHsId, categoryDataLoaded]);

  return [supportedCategoryHsIds, setSupportedCategoryHsIds];
}
