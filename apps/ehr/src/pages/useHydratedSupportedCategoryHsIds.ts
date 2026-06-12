import { HealthcareService } from 'fhir/r4b';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';

// Subset of the catalog entry shape that hydration actually reads. Kept
// permissive so callers can pass their richer types without conversion.
export interface SupportedCategoryCatalogEntry {
  code: string;
}

/**
 * Hydrates the group's stored `type[]` codes into the multi-select keying
 * shape the UI uses (FHIR HealthcareService ids for runtime-registered
 * categories; category codes for BOOKING_CONFIG entries). Idempotent — once
 * hydrated, the returned setter takes over so user edits aren't clobbered
 * by re-renders.
 *
 * The `categoryDataLoaded` flag is the *real* guard. The catalog map can
 * appear populated on the first render because BOOKING_CONFIG entries are
 * compiled in; gating on `map.size > 0` would lie and hydrate against a
 * partial map, dropping any FHIR-managed codes that arrive later.
 */
export function useHydratedSupportedCategoryHsIds(
  group: HealthcareService | undefined,
  categoryByHsId: Map<string, SupportedCategoryCatalogEntry>,
  categoryDataLoaded: boolean
): [string[], Dispatch<SetStateAction<string[]>>] {
  const [supportedCategoryHsIds, setSupportedCategoryHsIds] = useState<string[]>([]);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    if (!group || !categoryDataLoaded) return;

    const codes = (group.type || [])
      .flatMap((t) => t.coding || [])
      .map((c) => c.code)
      .filter((c): c is string => !!c);

    const allowed = new Set<string>();
    for (const [id, info] of categoryByHsId.entries()) {
      if (codes.includes(info.code)) allowed.add(id);
    }
    setSupportedCategoryHsIds([...allowed]);
    hydratedRef.current = true;
  }, [group, categoryByHsId, categoryDataLoaded]);

  return [supportedCategoryHsIds, setSupportedCategoryHsIds];
}
