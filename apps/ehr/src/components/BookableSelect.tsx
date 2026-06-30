import { Autocomplete, Chip, TextField } from '@mui/material';
import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import {
  getSlugForBookableResource,
  isLocationVirtual,
  SCHEDULE_DISPLAY_NAME_EXTENSION_URL,
  SERVICE_CATEGORY_SYSTEM,
  SLUG_SYSTEM,
} from 'utils';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { useApiClients } from '../hooks/useAppClients';

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
   * Restrict the picker to a subset of the bookable-target union. Omit to show
   * all three (back-compat default). Pass `['Location']` when the consumer is
   * picking a physical place a patient will be served (Groups and PR-direct
   * Schedules can span multiple Locations, so they're not meaningful answers
   * to "where").
   */
  resourceTypes?: BookableTargetType[];
  /**
   * When set, only include Location targets whose Schedule offers the given
   * service category. A Schedule with no `serviceCategory[]` is treated as
   * "supports all" (back-compat for pre-tagging Schedules); a Schedule with
   * codings present must include this code to qualify. Has no effect on
   * Group/PR targets — those carry service info on the resource itself, not
   * on a paired Schedule, and the patient flow already filters them via the
   * group/PR endpoints when a category is in scope.
   */
  serviceCategoryCode?: string;
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
  required,
  disabled,
  onLocationsLoaded,
  error,
  helperText,
  dataTestId,
}: BookableSelectProps): ReactElement {
  const { oystehr } = useApiClients();
  const [targets, setTargets] = useState<BookableTarget[]>([]);
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
          // PR-direct schedules: PractitionerRoles with a slug identifier.
          // The admin-set schedule display name lives on
          // PractitionerRole.extension (schedule-display-name) — written by
          // admin-update-practitioner-role and read by the EHR's
          // get-schedule. We include the referenced Practitioner (for the
          // provider name) and Location (used as the fallback schedule name
          // when no display-name extension is set, so the picker is always
          // disambiguating even before an admin sets an explicit name).
          getAllFhirSearchPages<PractitionerRole | Practitioner | Location>(
            {
              resourceType: 'PractitionerRole',
              params: [
                { name: 'identifier', value: `${SLUG_SYSTEM}|` },
                { name: '_include', value: 'PractitionerRole:practitioner' },
                { name: '_include', value: 'PractitionerRole:location' },
              ],
            },
            oystehr
          ),
        ]);

        if (cancelled) return;

        const locations = locationsWithSchedules.filter((r): r is Location => r.resourceType === 'Location');
        const schedules = locationsWithSchedules.filter((r): r is Schedule => r.resourceType === 'Schedule');

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

        setTargets(out);
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
    return targets.filter((t) => {
      if (allowedTypes && !allowedTypes.has(t.resourceType)) return false;
      if (t.resourceType === 'Location') {
        const isVirtual = t.rawLocation ? isLocationVirtual(t.rawLocation) : false;
        const passesMode = (isVirtual && wantVirtual) || (!isVirtual && wantInPerson);
        if (!passesMode) return false;
        if (serviceCategoryCode) {
          // Schedule-side service-category check. Two things make this
          // subtle:
          //   1. Schedule.serviceCategory is a multi-purpose CodeableConcept
          //      slot in this codebase — it also carries service-mode
          //      markers (SlotServiceCategory.{inPerson,virtual}ServiceMode)
          //      and could carry other system codings. Only
          //      SERVICE_CATEGORY_SYSTEM codings are real "category
          //      restrictions"; everything else is metadata that mustn't
          //      pollute the back-compat rule.
          //   2. A Location may have multiple Schedules (e.g., one per
          //      service category). The Location offers a service if ANY of
          //      its Schedules does — checking only the first Schedule would
          //      silently exclude Locations whose first Schedule happens to
          //      be for a different service.
          // Per-Schedule rule: empty SERVICE_CATEGORY_SYSTEM codings →
          // "supports all" (back-compat for pre-tagging Schedules and
          // mode-only Schedules); otherwise membership required. Location
          // passes if any Schedule satisfies the per-Schedule rule.
          const schedulesToCheck = t.schedules ?? (t.walkinSchedule ? [t.walkinSchedule] : []);
          const someScheduleSupports = schedulesToCheck.some((sched) => {
            const codes = (sched.serviceCategory ?? [])
              .flatMap((cc) => cc.coding ?? [])
              .filter((c) => c.system === SERVICE_CATEGORY_SYSTEM)
              .map((c) => c.code)
              .filter((c): c is string => !!c);
            return codes.length === 0 || codes.includes(serviceCategoryCode);
          });
          // Locations with NO Schedules attached can't actually be booked
          // against, but pre-fix behavior treated them as "no restrictions"
          // and let them through. Preserve that — the slot picker will
          // surface "no slots" later, which is the existing recovery path.
          if (schedulesToCheck.length > 0 && !someScheduleSupports) return false;
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
  }, [targets, mode, resourceTypes, serviceCategoryCode]);

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
    const stillValid = filteredTargets.some((t) => t.resourceType === selected.resourceType && t.id === selected.id);
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
      isOptionEqualToValue={(opt, val) => opt.resourceType === val.resourceType && opt.id === val.id}
      renderOption={(props, opt) => (
        <li {...props} key={`${opt.resourceType}/${opt.id}`}>
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
