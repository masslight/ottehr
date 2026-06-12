import { act, renderHook } from '@testing-library/react';
import { HealthcareService } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  SupportedCategoryCatalogEntry,
  useHydratedSupportedCategoryHsIds,
} from '../../src/pages/useHydratedSupportedCategoryHsIds';

// Helpers for catalog map composition. The page keys BOOKING_CONFIG entries
// by code (urgent-care, workers-comp) and FHIR-managed entries by their
// HealthcareService id (a UUID); this test mirrors that namespace split.
const BOOKING_CONFIG_ENTRY = (code: string): [string, SupportedCategoryCatalogEntry] => [code, { code }];
const FHIR_ENTRY = (hsId: string, code: string): [string, SupportedCategoryCatalogEntry] => [hsId, { code }];

const groupWithCategories = (...codes: string[]): HealthcareService => ({
  resourceType: 'HealthcareService',
  id: 'group-1',
  type: codes.map((code) => ({ coding: [{ system: 'https://example.com/sc', code }] })),
});

describe('useHydratedSupportedCategoryHsIds', () => {
  it('does not hydrate before group arrives', () => {
    const categoryByHsId = new Map([BOOKING_CONFIG_ENTRY('urgent-care')]);
    const { result } = renderHook(() => useHydratedSupportedCategoryHsIds(undefined, categoryByHsId, true));
    expect(result.current[0]).toEqual([]);
  });

  it('does not hydrate before the catalog query has resolved', () => {
    // Catch the race the fix is locking in: `group` resolves first, then the
    // catalog. The map appears populated only because BOOKING_CONFIG entries
    // are compiled in. Without the categoryDataLoaded gate the effect would
    // hydrate against a partial map and silently drop FHIR-managed codes.
    const partialMap = new Map([BOOKING_CONFIG_ENTRY('urgent-care')]);
    const { result } = renderHook(() =>
      useHydratedSupportedCategoryHsIds(groupWithCategories('urgent-care', 'massage'), partialMap, false)
    );
    expect(result.current[0]).toEqual([]);
  });

  it('hydrates with BOOKING_CONFIG + FHIR codes when both inputs are ready', () => {
    const fullMap = new Map([BOOKING_CONFIG_ENTRY('urgent-care'), FHIR_ENTRY('hs-uuid-massage', 'massage')]);
    const group = groupWithCategories('urgent-care', 'massage');
    const { result } = renderHook(() => useHydratedSupportedCategoryHsIds(group, fullMap, true));

    expect(new Set(result.current[0])).toEqual(new Set(['urgent-care', 'hs-uuid-massage']));
  });

  it('controlled race: group ready before catalog → hydration waits for catalog → FHIR code surfaces', () => {
    // Reproduce the deployed-env failure mode: group arrives first, catalog
    // arrives later. With the fix in place, hydration deferred to the
    // catalog-ready render and the FHIR-managed code now appears in the
    // hydrated set. Before the fix this would emit just ['urgent-care'].
    const partialMap = new Map([BOOKING_CONFIG_ENTRY('urgent-care')]);
    const fullMap = new Map([BOOKING_CONFIG_ENTRY('urgent-care'), FHIR_ENTRY('hs-uuid-massage', 'massage')]);
    const group = groupWithCategories('urgent-care', 'massage');

    const { result, rerender } = renderHook(
      ({ map, loaded }: { map: typeof partialMap; loaded: boolean }) =>
        useHydratedSupportedCategoryHsIds(group, map, loaded),
      { initialProps: { map: partialMap, loaded: false } }
    );

    // Mid-race: group is in, catalog still pending. Must NOT hydrate.
    expect(result.current[0]).toEqual([]);

    // Catalog arrives.
    rerender({ map: fullMap, loaded: true });
    expect(new Set(result.current[0])).toEqual(new Set(['urgent-care', 'hs-uuid-massage']));
  });

  it('idempotent: setter wins once user has touched the list', () => {
    // The ref is meant to prevent re-hydration clobbering user edits. After
    // hydration, calling the setter and then re-rendering with a different
    // (broader) catalog must NOT reset the user's selection.
    const fullMap = new Map([BOOKING_CONFIG_ENTRY('urgent-care'), FHIR_ENTRY('hs-uuid-massage', 'massage')]);
    const group = groupWithCategories('urgent-care', 'massage');
    const { result, rerender } = renderHook(
      ({ map, loaded }: { map: typeof fullMap; loaded: boolean }) =>
        useHydratedSupportedCategoryHsIds(group, map, loaded),
      { initialProps: { map: fullMap, loaded: true } }
    );

    // Initial hydration.
    expect(new Set(result.current[0])).toEqual(new Set(['urgent-care', 'hs-uuid-massage']));

    // Admin deselects everything.
    act(() => result.current[1]([]));
    expect(result.current[0]).toEqual([]);

    // Catalog grows (rare but possible if categories are added on another tab).
    const widerMap = new Map([
      BOOKING_CONFIG_ENTRY('urgent-care'),
      FHIR_ENTRY('hs-uuid-massage', 'massage'),
      FHIR_ENTRY('hs-uuid-acne', 'acne-facial'),
    ]);
    rerender({ map: widerMap, loaded: true });
    // User's empty selection must survive; hook does NOT re-hydrate.
    expect(result.current[0]).toEqual([]);
  });

  it('group with no matching codes hydrates to empty allow-list', () => {
    // A freshly-created group has empty type[]. Hydration must produce []
    // (and mark itself done so subsequent edits aren't clobbered).
    const fullMap = new Map([BOOKING_CONFIG_ENTRY('urgent-care'), FHIR_ENTRY('hs-uuid-massage', 'massage')]);
    const group: HealthcareService = { resourceType: 'HealthcareService', id: 'group-empty' };
    const { result } = renderHook(() => useHydratedSupportedCategoryHsIds(group, fullMap, true));
    expect(result.current[0]).toEqual([]);
  });
});
