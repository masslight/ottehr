import { Autocomplete, Chip, TextField } from '@mui/material';
import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import {
  getSlugForBookableResource,
  isBookingConfigServiceCategoryCode,
  isLocationInPerson,
  isLocationVirtual,
  SCHEDULE_DISPLAY_NAME_EXTENSION_URL,
  SLUG_SYSTEM,
} from 'utils';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { useApiClients } from '../hooks/useAppClients';
import {
  buildLocationInventories,
  LocationBookableInventory,
  resolveTargetsAtLocation,
  scheduleSupportsCategory,
} from './bookableTargetResolution';

/**
 * Union picker used by staff to pick a bookable target on the Add Patient
 * page. Returns one of:
 *   - a Location-actored Schedule (Location resource + its walk-in Schedule)
 *   - a Group (HealthcareService with a slug identifier)
 *   - a PR-direct Schedule (PractitionerRole with a slug identifier)
 *
 * The patient-flow already supports all three via `get-schedule`; this picker
 * lets staff target any of them from the EHR admin form without leaving the
 * EHR. See FR-5 for the URL pattern definitions.
 */

export type BookableTargetType = 'Location' | 'HealthcareService' | 'PractitionerRole';

export interface BookableTarget {
  resourceType: BookableTargetType;
  id: string;
  slug: string;
  name: string;
  /** Only set for Location targets — used by walk-in flow. */
  walkinSchedule?: Schedule;
  /**
   * All Schedules attached to this Location (Location targets only). A
   * Location with N service-specific Schedules surfaces all of them here so
   * the serviceCategoryCode filter can ask "does ANY of this Location's
   * Schedules support the picked category" rather than only consulting the
   * representative `walkinSchedule` (the first match), which would silently
   * exclude a Location whose first Schedule is for a different service.
   */
  schedules?: Schedule[];
  /** Original Location reference, only for Location targets, for downstream code that needs the raw resource. */
  rawLocation?: LocationWithWalkinSchedule;
  /**
   * Origin-Location slug for Group / PR-direct resolutions surfaced as
   * sub-options under a Location. Undefined for Location-tier targets
   * (the target IS the Location; its own slug is `slug`). The AddPatient
   * slot loader threads this into `get-schedule` as `atLocationSlug` so
   * multi-Location Groups narrow to the picked Location — without it,
   * get-schedule returns an empty slot list plus a `pickableLocations`
   * envelope, which the frontend surfaces as "no slots available".
   */
  atLocationSlug?: string;
}

export enum BookableMode {
  IN_PERSON,
  VIRTUAL,
  ALL,
}

interface BookableSelectProps {
  selected?: BookableTarget;
  setSelected: (target: BookableTarget | undefined) => void;
  /** Filter to in-person, virtual, or both. */
  mode?: BookableMode[];
  /**
   * Restrict the picker to a subset of the bookable-target union.
   *
   * - Omit: default flat mode. Locations, Groups, and PRs each appear as
   *   top-level options; the caller receives whichever type the user picked
   *   directly.
   * - Pass `['Location']`: switches the picker into the Location-rooted
   *   resolver mode. Every option is anchored to a Location, but the
   *   *selected target's `resourceType`* is not necessarily `'Location'` —
   *   when a Location doesn't offer the picked service via its own
   *   Schedule, the picker surfaces the underlying Group / PR-direct
   *   surface(s) at that Location as sub-options (e.g., "New York
   *   (Acupuncture Group)", "New York (Dr. Smith)"). The picked value's
   *   `resourceType` in that case is `'HealthcareService'` or
   *   `'PractitionerRole'`, with `atLocationSlug` stamped for the slot
   *   loader to narrow get-schedule to the picked Location. Callers must
   *   NOT assume `selected.resourceType === 'Location'` in this mode.
   * - Other combinations behave as strict type filters against the flat
   *   list (only the passed types appear as top-level options).
   */
  resourceTypes?: BookableTargetType[];
  /**
   * When set, only include Location targets whose Schedule offers the given
   * service category. For BOOKING_CONFIG (compile-in) categories the
   * "no codings = supports all" back-compat applies and only the
   * Location-Schedule tier qualifies (BOOKING_CONFIG codes can't live on
   * PR/Group-actored Schedules). For FHIR-backed categories every tier
   * requires strict opt-in: a Location-Schedule must explicitly tag the
   * code, and Group/PR tiers admit via `practitionerRoleOffersCategory`.
   * Pass `serviceCategoryFhirId` for FHIR categories so the PR-offering
   * check has the right HealthcareService id to look up.
   */
  serviceCategoryCode?: string;
  /**
   * FHIR HealthcareService id for the picked category when it's
   * FHIR-backed. Undefined for BOOKING_CONFIG categories (no FHIR id
   * exists). The resolver uses this for `practitionerRoleOffersCategory`
   * — without it, FHIR-category queries can only admit Locations via the
   * Location-Schedule tier (the Group/PR opt-in check is unreachable).
   */
  serviceCategoryFhirId?: string;
  required?: boolean;
  disabled?: boolean;
  /** Optional — invoked once the picker has loaded its full list (used by AddPatient to keep a side list of Locations). */
  onLocationsLoaded?: (locations: LocationWithWalkinSchedule[]) => void;
  error?: boolean;
  helperText?: string;
  dataTestId?: string;
}

function formatHumanName(p?: Practitioner): string {
  if (!p?.name?.[0]) return 'Unknown provider';
  const n = p.name[0];
  const parts = [n.prefix?.[0], n.given?.join(' '), n.family].filter(Boolean);
  return parts.join(' ') || 'Unknown provider';
}

export default function BookableSelect({
  selected,
  setSelected,
  mode = [BookableMode.IN_PERSON],
  resourceTypes,
  serviceCategoryCode,
  serviceCategoryFhirId,
  required,
  disabled,
  onLocationsLoaded,
  error,
  helperText,
  dataTestId,
}: BookableSelectProps): ReactElement {
  const { oystehr } = useApiClients();
  const [targets, setTargets] = useState<BookableTarget[]>([]);
  // Per-Location inventory used by the Locations-only path. Kept in state
  // alongside the flat `targets` list so the default (no-resourceTypes)
  // path stays on its existing logic — only the Locations-only path
  // expands a Location into Group/PR sub-options when its own Schedules
  // don't cover the picked category.
  const [inventories, setInventories] = useState<LocationBookableInventory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Capture the latest onLocationsLoaded callback in a ref so the load
  // effect doesn't need it in its dep array. Callers typically pass an
  // inline arrow, which would otherwise change identity every parent
  // render and refire the (heavy) FHIR-fetch effect — a render loop in
  // tests where the parent re-renders for any reason.
  const onLocationsLoadedRef = useRef(onLocationsLoaded);
  useEffect(() => {
    onLocationsLoadedRef.current = onLocationsLoaded;
  }, [onLocationsLoaded]);

  useEffect(() => {
    if (!oystehr) return;
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        // Run the three queries in parallel. Each returns a resource set we
        // narrow down into the BookableTarget union.
        const [locationsWithSchedules, healthcareServices, practitionerRolesWithPractitioners] = await Promise.all([
          getAllFhirSearchPages<Location | Schedule>(
            {
              resourceType: 'Location',
              params: [{ name: '_revinclude', value: 'Schedule:actor:Location' }],
            },
            oystehr
          ),
          // Groups: HealthcareServices with a slug identifier (those meant to be
          // bookable via URL). Filtering at the FHIR layer keeps every random
          // HealthcareService (e.g., service-category records that share the
          // same resourceType) out of the staff picker.
          getAllFhirSearchPages<HealthcareService>(
            {
              resourceType: 'HealthcareService',
              params: [{ name: 'identifier', value: `${SLUG_SYSTEM}|` }],
            },
            oystehr
          ),
          // All PractitionerRoles (not just slug-having ones). Two audiences,
          // one query:
          //   - Flat mode's PR-direct targets — only slug-having PRs are
          //     bookable via URL; the flat-target loop below filters by
          //     `getSlugForBookableResource(pr)` and skips the rest.
          //   - The Location-rooted resolver's Group + PR-direct tiers —
          //     Group membership doesn't require a slug (backend group-
          //     member queries in walkGroupMemberPractitionerRoleSchedules
          //     admit any PR passing `isPractitionerRoleMemberOfGroup`), so
          //     filtering by slug here would silently miss Groups whose
          //     qualifying members happen to be slug-less. Load everyone;
          //     the inventory builder then buckets by PR.location[]. The
          //     Schedule revinclude attaches each PR's Schedules; PRs with
          //     no Schedule get dropped in the inventory anyway (no
          //     bookable surface).
          //
          // Includes are the same shape as before: Practitioner (provider
          // name) and Location (fallback schedule name when the admin-set
          // schedule-display-name extension is absent).
          getAllFhirSearchPages<PractitionerRole | Practitioner | Location | Schedule>(
            {
              resourceType: 'PractitionerRole',
              params: [
                { name: '_include', value: 'PractitionerRole:practitioner' },
                { name: '_include', value: 'PractitionerRole:location' },
                { name: '_revinclude', value: 'Schedule:actor:PractitionerRole' },
              ],
            },
            oystehr
          ),
        ]);

        if (cancelled) return;

        const locations = locationsWithSchedules.filter((r): r is Location => r.resourceType === 'Location');
        const schedules = locationsWithSchedules.filter((r): r is Schedule => r.resourceType === 'Schedule');
        // PR-Schedules come from the PR query's revinclude — partition them
        // out of the PR result set so the inventory builder can index them
        // alongside the Location-actored Schedules.
        const prSchedules = practitionerRolesWithPractitioners.filter(
          (r): r is Schedule => r.resourceType === 'Schedule'
        );

        // Locations can have multiple Schedules — one per service category
        // is a common shape in customer configs. Capture all of them so the
        // service-category filter can inspect each instead of guessing at
        // the "right" one via .find. The walk-in flow still keeps a single
        // representative Schedule (the first match) for its scheduleId
        // derivation in AddPatient — same back-compat as before.
        const locationTargets: Array<LocationWithWalkinSchedule & { schedules: Schedule[] }> = locations.map((loc) => {
          const locSchedules = schedules.filter((s) => s.actor?.some((a) => a.reference === `Location/${loc.id}`));
          return { ...loc, walkinSchedule: locSchedules[0], schedules: locSchedules } as LocationWithWalkinSchedule & {
            schedules: Schedule[];
          };
        });
        onLocationsLoadedRef.current?.(locationTargets);

        const out: BookableTarget[] = [];

        for (const loc of locationTargets) {
          const slug = getSlugForBookableResource(loc);
          if (!loc.id || !slug) continue;
          out.push({
            resourceType: 'Location',
            id: loc.id,
            slug,
            name: loc.address?.state
              ? `${loc.address.state.toUpperCase()} — ${loc.name ?? 'Unnamed'}`
              : loc.name ?? 'Unnamed location',
            walkinSchedule: loc.walkinSchedule,
            schedules: loc.schedules,
            rawLocation: loc,
          });
        }

        for (const hs of healthcareServices) {
          if (hs.resourceType !== 'HealthcareService') continue;
          const slug = getSlugForBookableResource(hs);
          if (!hs.id || !slug) continue;
          out.push({
            resourceType: 'HealthcareService',
            id: hs.id,
            slug,
            name: `${hs.name ?? 'Unnamed group'}`,
          });
        }

        const practitionersById = new Map<string, Practitioner>();
        const prLocationsById = new Map<string, Location>();
        for (const r of practitionerRolesWithPractitioners) {
          if (r.resourceType === 'Practitioner' && r.id) practitionersById.set(r.id, r);
          if (r.resourceType === 'Location' && r.id) prLocationsById.set(r.id, r);
        }
        for (const r of practitionerRolesWithPractitioners) {
          if (r.resourceType !== 'PractitionerRole') continue;
          const slug = getSlugForBookableResource(r);
          if (!r.id || !slug) continue;
          const pracId = r.practitioner?.reference?.split('/')[1];
          const practitioner = pracId ? practitionersById.get(pracId) : undefined;
          const providerName = formatHumanName(practitioner);

          // Schedule name resolution:
          //   1. Admin-set schedule-display-name extension on the PR (canonical).
          //   2. PR's Location.name (sensible fallback so a provider with
          //      multiple PRs is always disambiguated by location even before
          //      the admin sets an explicit schedule name).
          //   3. Nothing — display just the provider name.
          const explicitName = (r.extension ?? []).find((e) => e.url === SCHEDULE_DISPLAY_NAME_EXTENSION_URL)
            ?.valueString;
          const prLocationId = r.location?.[0]?.reference?.split('/')[1];
          const prLocationName = prLocationId ? prLocationsById.get(prLocationId)?.name : undefined;
          const scheduleName = explicitName?.trim() || prLocationName;
          const label = scheduleName ? `${providerName}: ${scheduleName}` : providerName;

          out.push({
            resourceType: 'PractitionerRole',
            id: r.id,
            slug,
            name: label,
          });
        }

        // Sort each group by name; surface Locations first, then Groups, then PRs.
        const typeOrder: Record<BookableTargetType, number> = {
          Location: 0,
          HealthcareService: 1,
          PractitionerRole: 2,
        };
        out.sort((a, b) => typeOrder[a.resourceType] - typeOrder[b.resourceType] || a.name.localeCompare(b.name));

        // Build per-Location inventory in parallel with the flat targets
        // list. Same source data, different shape — the flat list serves
        // the default mode (callers asking for all three types as
        // standalone entries), the inventory serves the Locations-only
        // mode (callers asking for Locations, optionally surfacing
        // Group/PR sub-options when the Location's own Schedule doesn't
        // cover the picked category).
        const allPrs = practitionerRolesWithPractitioners.filter(
          (r): r is PractitionerRole => r.resourceType === 'PractitionerRole'
        );
        const allSchedulesForInventory = [...schedules, ...prSchedules];
        const newInventories = buildLocationInventories({
          locations,
          schedules: allSchedulesForInventory,
          groups: healthcareServices,
          prs: allPrs,
          practitionersById,
        });

        setTargets(out);
        setInventories(newInventories);
      } catch (err) {
        console.error('error loading bookable targets', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [oystehr]);

  const filteredTargets = useMemo(() => {
    const wantInPerson = mode.includes(BookableMode.IN_PERSON) || mode.includes(BookableMode.ALL);
    const wantVirtual = mode.includes(BookableMode.VIRTUAL) || mode.includes(BookableMode.ALL);
    const allowedTypes = resourceTypes ? new Set(resourceTypes) : undefined;

    // Locations-only path: walk the per-Location inventories and resolve
    // each Location to its winning bookable tier. A Location appears iff
    // SOME target at it survives the resolver. Single passing target →
    // silent pick (label is the bare Location name); multiple passing
    // targets at the winning tier → sub-options labeled with a typeSuffix
    // ("New York (Acupuncture Group)", "New York (Dr. Smith)"). The
    // Group/PR sub-options inherit their resourceType and id from the
    // underlying resource, so the downstream slot loader + submit path key
    // off them exactly as a directly-picked Group/PR target would.
    if (allowedTypes && allowedTypes.size === 1 && allowedTypes.has('Location')) {
      const expanded: BookableTarget[] = [];
      for (const inv of inventories) {
        // A Location can be both virtual and in-person (dual-mode); it should
        // surface in either mode it's tagged for.
        const isVirtual = isLocationVirtual(inv.location);
        const isInPerson = isLocationInPerson(inv.location);
        if (!((isVirtual && wantVirtual) || (isInPerson && wantInPerson))) continue;
        const passing = resolveTargetsAtLocation(inv, { serviceCategoryCode, serviceCategoryFhirId });
        if (passing.length === 0) continue;
        // Fill slug per target. The resolver leaves slug='' because it's a
        // pure helper without access to the slug-extraction util. For
        // Group / PR sub-options also stamp the origin-Location slug —
        // downstream (AddPatient's slot loader) threads it as
        // `atLocationSlug` on the get-schedule call so multi-Location
        // Groups narrow to the picked Location rather than returning the
        // empty `pickableLocations` envelope.
        const originLocationSlug = getSlugForBookableResource(inv.location);
        for (const r of passing) {
          let slug: string | undefined;
          if (r.resourceType === 'Location') {
            slug = originLocationSlug;
          } else if (r.resourceType === 'HealthcareService') {
            const g = inv.groupsHere.find((g) => g.id === r.id);
            slug = g ? getSlugForBookableResource(g) : undefined;
          } else if (r.resourceType === 'PractitionerRole') {
            const pair = inv.prsHere.find(({ pr }) => pr.id === r.id);
            slug = pair ? getSlugForBookableResource(pair.pr) : undefined;
          }
          if (!slug) continue;
          const showSuffix = passing.length > 1 && r.typeSuffix;
          expanded.push({
            resourceType: r.resourceType,
            id: r.id,
            slug,
            name: showSuffix ? `${r.baseName} (${r.typeSuffix})` : r.baseName,
            walkinSchedule: r.walkinSchedule,
            schedules: r.schedules,
            rawLocation: r.rawLocation
              ? ({ ...r.rawLocation, walkinSchedule: r.walkinSchedule } as LocationWithWalkinSchedule)
              : undefined,
            // Only stamp atLocationSlug for the sub-option tiers (Group /
            // PR) — for Location targets it would be the same as `slug`
            // and the slot loader already knows how to narrow by the
            // Location slug directly for scheduleType=location.
            atLocationSlug: r.resourceType === 'Location' ? undefined : originLocationSlug,
          });
        }
      }
      // Display order is a full alphabetical sort on the composed option
      // name (base Location name, with a "(<suffix>)" fragment appended
      // for sub-options). Because every sub-option under a given Location
      // shares the same base-name prefix, all sub-options for one
      // Location cluster together in the list; within that cluster, order
      // is alphabetical by suffix (typeSuffix = Group name or provider
      // name). That's a stable, predictable order in practice; not the
      // resolver's insertion order — the resolver only returns one tier
      // at a time anyway, so the visual distinction is minor. If ordering
      // needs to become tier-driven (e.g., always list Groups above PRs
      // when both appear), sort on `tier` first here.
      expanded.sort((a, b) => a.name.localeCompare(b.name));
      return expanded;
    }

    return targets.filter((t) => {
      if (allowedTypes && !allowedTypes.has(t.resourceType)) return false;
      if (t.resourceType === 'Location') {
        const isVirtual = t.rawLocation ? isLocationVirtual(t.rawLocation) : false;
        // Default to in-person when the raw Location is unavailable (mirrors the
        // prior `!isVirtual` fallback for such targets).
        const isInPerson = t.rawLocation ? isLocationInPerson(t.rawLocation) : true;
        const passesMode = (isVirtual && wantVirtual) || (isInPerson && wantInPerson);
        if (!passesMode) return false;
        if (serviceCategoryCode) {
          // Shared per-Schedule admit rule with the Locations-only
          // resolver: BOOKING_CONFIG uses empty-supports-all back-compat,
          // FHIR requires strict opt-in, only SERVICE_CATEGORY_SYSTEM
          // codings count (mode markers and foreign-system codings are
          // ignored). The helper lives in `bookableTargetResolution.ts`
          // so both call sites can't drift.
          //
          // Location-level rule: passes if ANY attached Schedule admits.
          // Location with no attached Schedules → admit for BOOKING_CONFIG
          // (preserves the pre-fix "no restrictions" behavior; the slot
          // picker surfaces "no slots" as the recovery path). For FHIR
          // categories the flat filter drops here because it can't
          // consider Group/PR-at-Location paths — those are the
          // Locations-only resolver's job.
          const isBookingConfig = isBookingConfigServiceCategoryCode(serviceCategoryCode);
          const schedulesToCheck = t.schedules ?? (t.walkinSchedule ? [t.walkinSchedule] : []);
          if (isBookingConfig && schedulesToCheck.length === 0) return true;
          const someScheduleSupports = schedulesToCheck.some((sched) =>
            scheduleSupportsCategory(sched, serviceCategoryCode, isBookingConfig)
          );
          if (!someScheduleSupports) return false;
        }
        return true;
      }
      if (t.resourceType === 'HealthcareService') {
        // Filter groups by declared service-mode characteristic. If we can't
        // determine modes (no characteristic), include — better to over-show
        // than to silently hide groups that lack the explicit annotation.
        // We need the raw resource for this; we don't store it on the target,
        // so for v1 just include all groups regardless of mode. Mode is a
        // patient-facing distinction; staff selecting a group should see all
        // available groups regardless of mode and let the slot picker reveal
        // which services apply.
        return true;
      }
      // PractitionerRole (direct schedule): same loose policy — include all.
      return true;
    });
  }, [targets, inventories, mode, resourceTypes, serviceCategoryCode, serviceCategoryFhirId]);

  // Identity comparison for BookableTarget. Group/PR sub-options can
  // legitimately repeat the same (resourceType, id) across different
  // origin Locations — the same Group is offered at Location A and B, or
  // a PR has location[] entries for both. `atLocationSlug` disambiguates
  // origin, so identity must include it: otherwise the same picked Group
  // under Location A would be considered "still valid" when only its
  // Location B surface remains in the filtered list, and the selection
  // would silently retain a stale atLocationSlug the slot loader keys off
  // of. Compare with nullish-coalesce so Location-tier picks (undefined
  // atLocationSlug on both sides) still match cleanly.
  const targetsAreSame = (a: BookableTarget, b: BookableTarget): boolean =>
    a.resourceType === b.resourceType && a.id === b.id && (a.atLocationSlug ?? '') === (b.atLocationSlug ?? '');

  // Drop a stale selection when the active filters (mode / resourceTypes /
  // serviceCategoryCode) push it out of the filtered list. Without this, the
  // user would be left with a `selected` that doesn't appear in the dropdown
  // and could still be submitted — making it possible to book a Location that
  // no longer offers the picked service. Targets are referentially stable so
  // identity comparison is sufficient; if the load hasn't finished yet
  // (filteredTargets empty + isLoading true) we leave the selection alone so
  // an in-flight load doesn't clobber a parent-seeded value.
  useEffect(() => {
    if (!selected) return;
    if (isLoading && filteredTargets.length === 0) return;
    const stillValid = filteredTargets.some((t) => targetsAreSame(t, selected));
    if (!stillValid) setSelected(undefined);
  }, [filteredTargets, isLoading, selected, setSelected]);

  const typeChip = (t: BookableTargetType): string =>
    t === 'Location' ? 'Location' : t === 'HealthcareService' ? 'Group' : 'Direct';

  return (
    <Autocomplete
      data-testid={dataTestId}
      disabled={disabled}
      value={selected ?? null}
      onChange={(_, value) => setSelected(value ?? undefined)}
      options={filteredTargets}
      loading={isLoading}
      getOptionLabel={(opt) => opt.name}
      // Identity must include atLocationSlug — the same Group/PR can be
      // offered under multiple origin Locations and each surfaces as a
      // distinct option; without this, MUI would treat them as duplicates,
      // collapsing them into one option and (worse) matching a picked
      // Location A sub-option to a Location B sub-option on re-render.
      // Keep the nullish-coalesce in sync with the stale-selection guard
      // above so identity is uniform across all comparison sites.
      isOptionEqualToValue={(opt, val) => targetsAreSame(opt, val)}
      renderOption={(props, opt) => (
        // Same reason as isOptionEqualToValue: React's list key must be
        // unique across all rendered options. Two options that share
        // (resourceType, id) but differ only by atLocationSlug would
        // otherwise generate duplicate-key warnings AND lose identity for
        // Autocomplete's selection tracking. Empty-string fallback keeps
        // Location-tier picks (no atLocationSlug) stable.
        <li {...props} key={`${opt.resourceType}/${opt.id}/${opt.atLocationSlug ?? ''}`}>
          <span>{opt.name}</span>
          <Chip
            label={typeChip(opt.resourceType)}
            size="small"
            sx={{ ml: 1, height: 18, fontSize: 11 }}
            color={
              opt.resourceType === 'Location'
                ? 'default'
                : opt.resourceType === 'HealthcareService'
                ? 'primary'
                : 'secondary'
            }
          />
        </li>
      )}
      fullWidth
      renderInput={(params) => (
        <TextField
          {...params}
          label="Where to book"
          placeholder={
            resourceTypes && resourceTypes.length === 1 && resourceTypes[0] === 'Location'
              ? 'Search location'
              : 'Search location, group, or provider'
          }
          required={required}
          error={error}
          helperText={error ? helperText : undefined}
        />
      )}
    />
  );
}
