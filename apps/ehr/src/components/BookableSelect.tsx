import { Autocomplete, Chip, TextField } from '@mui/material';
import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import { getSlugForBookableResource, isLocationVirtual, SCHEDULE_DISPLAY_NAME_EXTENSION_URL, SLUG_SYSTEM } from 'utils';
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
  required?: boolean;
  disabled?: boolean;
  /** Optional — invoked once the picker has loaded its full list (used by AddPatient to keep a side list of Locations). */
  onLocationsLoaded?: (locations: LocationWithWalkinSchedule[]) => void;
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
  required,
  disabled,
  onLocationsLoaded,
}: BookableSelectProps): ReactElement {
  const { oystehr } = useApiClients();
  const [targets, setTargets] = useState<BookableTarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

        const locationTargets: LocationWithWalkinSchedule[] = locations.map((loc) => {
          const schedule = schedules.find((s) => s.actor?.some((a) => a.reference === `Location/${loc.id}`));
          return { ...loc, walkinSchedule: schedule } as LocationWithWalkinSchedule;
        });
        if (onLocationsLoaded) onLocationsLoaded(locationTargets);

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
  }, [oystehr, onLocationsLoaded]);

  const filteredTargets = useMemo(() => {
    const wantInPerson = mode.includes(BookableMode.IN_PERSON) || mode.includes(BookableMode.ALL);
    const wantVirtual = mode.includes(BookableMode.VIRTUAL) || mode.includes(BookableMode.ALL);
    return targets.filter((t) => {
      if (t.resourceType === 'Location') {
        const isVirtual = t.rawLocation ? isLocationVirtual(t.rawLocation) : false;
        return (isVirtual && wantVirtual) || (!isVirtual && wantInPerson);
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
  }, [targets, mode]);

  const typeChip = (t: BookableTargetType): string =>
    t === 'Location' ? 'Location' : t === 'HealthcareService' ? 'Group' : 'Direct';

  return (
    <Autocomplete
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
          placeholder="Search location, group, or provider"
          required={required}
        />
      )}
    />
  );
}
