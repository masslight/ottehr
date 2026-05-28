import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Operation } from 'fast-json-patch';
import { CodeableConcept, HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listServiceCategories } from 'src/api/api';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import {
  getAllFhirSearchPages,
  getGroupAllLocations,
  getGroupAssignmentMode,
  getPatchBinary,
  getSlugForBookableResource,
  GROUP_OWNED_CHARACTERISTIC_SYSTEMS,
  groupCharacteristics,
  mergeOwnedCharacteristics,
  SCHEDULE_STRATEGY_SYSTEM,
  SERVICE_CATEGORY_SYSTEM,
  SLUG_SYSTEM,
} from 'utils';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

type AssignmentMode = 'anonymous' | 'provider';

const INTAKE_URL = import.meta.env.VITE_APP_PATIENT_APP_URL;

export default function GroupPage(): ReactElement {
  return (
    <PageContainer>
      <GroupPageContent />
    </PageContainer>
  );
}

function GroupPageContent(): ReactElement {
  const { oystehr, oystehrZambda } = useApiClients();

  const groupID = useParams()['group-id'] as string;

  const [group, setGroup] = useState<HealthcareService | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [locations, setLocations] = useState<Location[] | undefined>(undefined);
  const [practitioners, setPractitioners] = useState<Practitioner[] | undefined>(undefined);
  const [practitionerRoles, setPractitionerRoles] = useState<PractitionerRole[] | undefined>(undefined);
  // Schedules owned by the PRs above (via _revinclude). Used to deep-link
  // each provider in the providers-per-location widget to their schedule
  // editor. Stored alongside PRs so the PR→Schedule mapping can be
  // derived rather than independently maintained.
  const [schedules, setSchedules] = useState<Schedule[] | undefined>(undefined);
  // The group's `.location[]` — the admin-set location lever. Composes with
  // any pre-existing PR.healthcareService[] back-references at slot-
  // resolution time (PR back-refs are no longer managed from this page;
  // edit them via per-PR config pages if needed).
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  // When true, the group pools from every active PR in the system, ignoring
  // any specific Location selection. The Location picker is disabled (but
  // still visible) while this is on; toggling off restores prior picker state.
  const [allLocations, setAllLocations] = useState<boolean>(false);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('anonymous');
  // Categories the group supports. Authoritative — what the patient is allowed
  // to book through this group. Admin-curated; a Massage group containing a
  // multi-skill member shouldn't expose that member's other categories.
  const [supportedCategoryHsIds, setSupportedCategoryHsIds] = useState<string[]>([]);
  const [name, setName] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Load the clinic-wide service-category catalog to translate role
  // healthcareService refs → category code / name / duration for display.
  const { data: categoryData } = useQuery({
    queryKey: ['service-categories-list-for-group-admin'],
    queryFn: async () => {
      if (!oystehrZambda) return { serviceCategories: [] };
      try {
        return await listServiceCategories(oystehrZambda);
      } catch {
        return { serviceCategories: [] };
      }
    },
    enabled: !!oystehrZambda,
  });
  // Quick lookup: HealthcareService.id → category metadata. Derived inside
  // useMemo so the dependency is stable across renders.
  const categoryByHsId = useMemo(() => {
    const available = categoryData?.serviceCategories || [];
    const map = new Map<
      string,
      {
        code: string;
        name: string;
        durationMinutes: number;
        serviceModes: Array<'in-person' | 'virtual'>;
        visitTypes: Array<'prebook' | 'walk-in'>;
      }
    >();
    for (const sc of available) {
      if ((sc as any).id) {
        map.set((sc as any).id, {
          code: sc.code,
          name: sc.name,
          durationMinutes: (sc as any).config?.durationMinutes ?? 15,
          serviceModes: ((sc as any).config?.serviceModes ?? ['in-person']) as Array<'in-person' | 'virtual'>,
          visitTypes: ((sc as any).config?.visitTypes ?? ['prebook']) as Array<'prebook' | 'walk-in'>,
        });
      }
    }
    return map;
  }, [categoryData]);

  // For each Location, count the distinct active providers that picking the
  // Location would pull into the group's pool. "Provider" = distinct
  // Practitioner reference among active PRs that reference the Location via
  // their .location[]. Multiple PRs of the same provider at the same
  // Location (e.g. intake + surgery schedules) count once — this is a
  // people-count hint for the admin, not a slot-count.
  const providerCountByLocationId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const loc of locations || []) {
      if (!loc.id) continue;
      const providerRefs = new Set<string>();
      for (const role of practitionerRoles || []) {
        if (role.active === false) continue;
        const hits = role.location?.some((ref) => ref.reference === `Location/${loc.id}`);
        if (!hits) continue;
        const pracRef = role.practitioner?.reference;
        if (pracRef) providerRefs.add(pracRef);
      }
      counts.set(loc.id, providerRefs.size);
    }
    return counts;
  }, [locations, practitionerRoles]);

  // Picker options: only Locations with status=active are pickable. Matches
  // the filter used when creating PractitionerRoles (PractitionerRoleList:
  // `params: [{ name: 'status', value: 'active' }]`), so admins can't
  // attach a Location to this group that's effectively invisible elsewhere.
  // The raw `locations` fetch is intentionally not filtered — already-
  // attached legacy Locations whose status has since flipped still need
  // their name resolved for chips and the per-category subtext.
  // Sort order: Locations with at least one active provider come first,
  // then Locations with none. Within each tier, sort alphabetically
  // ascending by Location name.
  const sortedLocationIds = useMemo(() => {
    const nameById = new Map((locations || []).filter((l) => l.id).map((l) => [l.id!, l.name || ''] as const));
    return (locations || [])
      .filter((l) => !!l.id && l.status === 'active')
      .map((l) => l.id!)
      .sort((a, b) => {
        const aHas = (providerCountByLocationId.get(a) ?? 0) > 0;
        const bHas = (providerCountByLocationId.get(b) ?? 0) > 0;
        if (aHas !== bHas) return aHas ? -1 : 1;
        return (nameById.get(a) ?? '').localeCompare(nameById.get(b) ?? '');
      });
  }, [locations, providerCountByLocationId]);

  // PR id → its first Schedule's id, derived from the Schedules fetched
  // alongside the PRs. Only counts Schedules where the PR is the PRIMARY
  // actor (actor[0]) — SchedulePage and the EHR get-schedule zambda both
  // resolve owner type via `schedule.actor[0].reference`, so a multi-
  // actor Schedule like `[Location, PR]` would render as Location-owned
  // even though our `_revinclude:Schedule:actor:PractitionerRole`
  // returned it. Restricting to primary keeps the link pointed at a
  // Schedule SchedulePage will actually render as a PR's schedule.
  const scheduleIdByPrId = useMemo(() => {
    const map = new Map<string, string>();
    for (const sched of schedules ?? []) {
      if (!sched.id) continue;
      const primary = sched.actor?.[0]?.reference;
      if (!primary) continue;
      const [actorType, actorId] = primary.split('/');
      if (actorType === 'PractitionerRole' && actorId && !map.has(actorId)) {
        map.set(actorId, sched.id);
      }
    }
    return map;
  }, [schedules]);

  // Read-only breakdown for the widget below the Location picker: active
  // providers at each in-pool location, with the group-relevant services
  // each one offers. Surfaces what the location-based composition will
  // pool, without re-introducing a per-PR picker on this page. A provider
  // with multiple PRs at the same location (e.g. intake + surgery
  // schedules) shows once per location with the union of relevant services
  // across their PRs there. Providers offering none of the group's
  // services are hidden (they don't contribute).
  //
  // Output differs slightly between the two composition modes:
  //   - selected locations: keep every selected location in the output,
  //     including ones with no relevant providers, since the admin chose
  //     each and "this one's empty" is actionable signal.
  //   - all locations: filter out empty ones — admin chose "everywhere,"
  //     not each individually, so flooding the widget with "no providers
  //     here" rows for unrelated locations would drown out the signal.
  const locationProviderRollup = useMemo(() => {
    if (!allLocations && selectedLocationIds.length === 0) return [];
    const relevantHsIdSet = new Set(supportedCategoryHsIds);
    const locationById = new Map((locations || []).filter((l) => l.id).map((l) => [l.id!, l] as const));
    const targetLocationIds = allLocations
      ? (locations || []).map((l) => l.id).filter((id): id is string => !!id)
      : selectedLocationIds;
    const targetLocationIdSet = new Set(targetLocationIds);
    const byLocation = new Map<string, Map<string, { name: string; services: Set<string>; scheduleId?: string }>>();
    for (const role of practitionerRoles || []) {
      if (role.active === false) continue;
      if (!role.id) continue;
      const pracId = role.practitioner?.reference?.split('/')[1];
      if (!pracId) continue;
      for (const locRef of role.location || []) {
        const locId = locRef.reference?.split('/')[1];
        if (!locId || !targetLocationIdSet.has(locId)) continue;
        if (!byLocation.has(locId)) byLocation.set(locId, new Map());
        const byPrac = byLocation.get(locId)!;
        if (!byPrac.has(pracId)) {
          const prac = (practitioners || []).find((p) => p.id === pracId);
          const name = prac?.name?.[0] ? oystehr?.fhir.formatHumanName(prac.name[0]) || 'Unknown' : 'Unknown';
          // Resolve to the first PR-for-this-practitioner-at-this-location's
          // Schedule. A provider with intake + surgery PRs at the same
          // location collapses to one row in the widget; the link lands
          // on whichever PR's Schedule we encountered first.
          byPrac.set(pracId, { name, services: new Set<string>(), scheduleId: scheduleIdByPrId.get(role.id) });
        }
        const entry = byPrac.get(pracId)!;
        for (const hsRef of role.healthcareService || []) {
          const hsId = hsRef.reference?.split('/')[1];
          if (!hsId || !relevantHsIdSet.has(hsId)) continue;
          const catName = categoryByHsId.get(hsId)?.name;
          if (catName) entry.services.add(catName);
        }
      }
    }
    const rows = targetLocationIds.map((locId) => {
      const loc = locationById.get(locId);
      const byPrac = byLocation.get(locId) ?? new Map();
      const providers = Array.from(byPrac.entries())
        .filter(([, entry]) => entry.services.size > 0)
        .map(([id, entry]) => ({
          id,
          name: entry.name,
          services: Array.from(entry.services).sort(),
          scheduleId: entry.scheduleId,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return {
        locationId: locId,
        locationName: loc?.name || locId,
        providers,
      };
    });
    const filtered = allLocations ? rows.filter((r) => r.providers.length > 0) : rows;
    return filtered.sort((a, b) => a.locationName.localeCompare(b.locationName));
  }, [
    allLocations,
    selectedLocationIds,
    locations,
    practitionerRoles,
    practitioners,
    supportedCategoryHsIds,
    categoryByHsId,
    oystehr,
    scheduleIdByPrId,
  ]);

  // Build one booking link per (category × mode × flow) the category supports.
  // No location or provider targeting — the patient lands on the group's slot-
  // list page and picks from there. Categories come from the group's admin-
  // curated allow-list (supportedCategoryHsIds), independent of which members
  // happen to be in the group; the slot resolver decides who's bookable.
  const bookingLinks = useMemo(() => {
    if (!slug) return [];
    const groupParams = `bookingOn=${slug}&scheduleType=group`;

    const cats = supportedCategoryHsIds
      .map((hsId) => categoryByHsId.get(hsId))
      .filter((c): c is NonNullable<typeof c> => !!c);

    const links: Array<{ label: string; url: string }> = [];
    for (const cat of cats) {
      for (const mode of cat.serviceModes) {
        for (const flow of cat.visitTypes) {
          const modeLabel = mode === 'virtual' ? ' [virtual]' : '';
          const flowLabel = flow === 'walk-in' ? ' [walk-in]' : ' [prebook]';
          const flowRoot = flow === 'walk-in' ? 'walkin' : 'prebook';
          links.push({
            label: `${cat.name}${modeLabel}${flowLabel} — ${cat.durationMinutes} min`,
            url: `${INTAKE_URL}/${flowRoot}/${mode}?${groupParams}&serviceCategory=${encodeURIComponent(cat.code)}`,
          });
        }
      }
    }
    return links;
  }, [slug, supportedCategoryHsIds, categoryByHsId]);

  const getOptions = useCallback(async () => {
    if (!oystehr) {
      console.log('oystehr client is not defined');
      return;
    }
    // Phase 1: load the group so the rest of the fetch graph knows which
    // Locations are already attached. Standalone GET — short and gates
    // phase 2.
    const groupTemp = await oystehr.fhir.get<HealthcareService>({
      resourceType: 'HealthcareService',
      id: groupID,
    });
    const attachedLocationIds = (groupTemp.location ?? [])
      .map((ref) => ref.reference?.split('/')[1])
      .filter((id): id is string => !!id);

    // Phase 2 (parallel): paginated PRs (with their Practitioners _included),
    // paginated active Locations, and a supplemental fetch for any already-
    // attached Locations. PRs are paginated for the same reason Locations
    // are — at scale, `_count=1000` silently truncates and the widget loses
    // anyone beyond the first page. Active Locations alone can exceed 1000,
    // so paginate with `status=active` pushed to the server to keep each
    // page small. The supplemental Locations fetch covers groups that have
    // a Location attached whose status has since flipped to inactive —
    // without it, those Locations would vanish from chips/widget/subtext
    // as soon as we filter the main fetch by status.
    const [practitionerResources, activeLocations, attachedLocations] = await Promise.all([
      getAllFhirSearchPages<PractitionerRole | Practitioner | Schedule>(
        {
          resourceType: 'PractitionerRole',
          params: [
            { name: '_include', value: 'PractitionerRole:practitioner' },
            // Pull each PR's owning Schedule along so the providers-per-
            // location widget can deep-link to the schedule editor without
            // an extra round trip per click.
            { name: '_revinclude', value: 'Schedule:actor:PractitionerRole' },
          ],
        },
        oystehr
      ),
      getAllFhirSearchPages<Location>(
        {
          resourceType: 'Location',
          params: [{ name: 'status', value: 'active' }],
        },
        oystehr
      ),
      attachedLocationIds.length > 0
        ? oystehr.fhir
            .search<Location>({
              resourceType: 'Location',
              params: [{ name: '_id', value: attachedLocationIds.join(',') }],
            })
            .then((b) => b.unbundle())
        : Promise.resolve<Location[]>([]),
    ]);

    const practitionersTemp = practitionerResources.filter((r): r is Practitioner => r.resourceType === 'Practitioner');
    const practitionerRolesTemp = practitionerResources.filter(
      (r): r is PractitionerRole => r.resourceType === 'PractitionerRole'
    );
    const schedulesTemp = practitionerResources.filter((r): r is Schedule => r.resourceType === 'Schedule');

    const locationsTemp: Location[] = [...activeLocations];
    const seenLocationIds = new Set(activeLocations.map((l) => l.id).filter((id): id is string => !!id));
    for (const loc of attachedLocations) {
      if (loc.id && !seenLocationIds.has(loc.id)) {
        locationsTemp.push(loc);
        seenLocationIds.add(loc.id);
      }
    }

    setGroup(groupTemp);
    setName(groupTemp.name ?? '');
    setSlug(getSlugForBookableResource(groupTemp) ?? '');
    setLocations(locationsTemp);
    setPractitioners(practitionersTemp);
    setPractitionerRoles(practitionerRolesTemp);
    setSchedules(schedulesTemp);
    setSelectedLocationIds(attachedLocationIds);

    setAssignmentMode(getGroupAssignmentMode(groupTemp) ?? 'anonymous');
    setAllLocations(getGroupAllLocations(groupTemp) ?? false);
  }, [oystehr, groupID]);

  // Resolve the group's authoritative supported-categories list. group.type[]
  // stores category codes; the multi-select keys on HS ids. We map via the
  // catalog (categoryByHsId, populated by the service-categories query). A
  // group with empty type[] (e.g., freshly created) hydrates to an empty
  // allow-list — the admin must explicitly select services.
  const supportedHydratedRef = useRef(false);
  useEffect(() => {
    if (supportedHydratedRef.current) return;
    if (!group || !categoryByHsId.size) return;

    const codes = (group.type || [])
      .flatMap((t) => t.coding || [])
      .map((c) => c.code)
      .filter((c): c is string => !!c);

    const allowed = new Set<string>();
    for (const [id, info] of categoryByHsId.entries()) {
      if (codes.includes(info.code)) allowed.add(id);
    }
    setSupportedCategoryHsIds([...allowed]);
    supportedHydratedRef.current = true;
  }, [group, categoryByHsId]);

  useEffect(() => {
    void getOptions();
  }, [getOptions]);

  async function onSubmit(event: any): Promise<void> {
    try {
      event.preventDefault();
      if (!oystehr) return;
      setLoading(true);

      // Locations are admin-curated directly via selectedLocationIds (the
      // source of truth for the group's `.location[]`). The reader expands
      // each Location into the PR-schedules at that Location via the
      // `pools-providers` strategy set below. Categories are also admin-
      // curated (Option A): supportedCategoryHsIds is what the patient is
      // allowed to book through this group, regardless of what a member's
      // PR additionally exposes.
      // When the all-locations toggle is on, write an empty .location[] so
      // the persisted shape reflects "pool everywhere" cleanly. Toggling off
      // later starts the admin from a fresh picker.
      const selectedLocationRefs = allLocations
        ? []
        : selectedLocationIds.map((id) => ({ reference: `Location/${id}` }));
      const supportedTypes: CodeableConcept[] = supportedCategoryHsIds
        .map((hsId) => categoryByHsId.get(hsId))
        .filter((x): x is NonNullable<typeof x> => !!x)
        .map((cat) => ({
          coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: cat.code, display: cat.name }],
          text: cat.name,
        }));

      const patchOperations: Operation[] = [
        { op: group?.location ? 'replace' : 'add', path: '/location', value: selectedLocationRefs },
        { op: group?.type ? 'replace' : 'add', path: '/type', value: supportedTypes },
      ];

      // Replace this page's own characteristic codings on save; preserve any
      // characteristic codings owned by other systems. Strategy lives here
      // too — the group form sets `pools-providers` so the reader knows to
      // expand .location[] (and .healthcareService[] back-refs) into PR
      // schedules at slot-resolution time.
      const ownedCharacteristicSystems = [...GROUP_OWNED_CHARACTERISTIC_SYSTEMS, SCHEDULE_STRATEGY_SYSTEM];
      const newCharacteristics = mergeOwnedCharacteristics(group?.characteristic, ownedCharacteristicSystems, [
        ...groupCharacteristics({ assignmentMode, allLocations }),
        {
          coding: [{ system: SCHEDULE_STRATEGY_SYSTEM, code: 'pools-providers', display: 'Pools Providers' }],
        },
      ]);
      patchOperations.push({
        op: group?.characteristic ? 'replace' : 'add',
        path: '/characteristic',
        value: newCharacteristics,
      });

      const currentSlug = group ? getSlugForBookableResource(group) ?? '' : '';
      if (group && slug !== currentSlug) {
        const newIdentifierList = group.identifier?.filter((identifier) => identifier.system !== SLUG_SYSTEM) || [];
        if (slug) newIdentifierList.push({ system: SLUG_SYSTEM, value: slug });
        patchOperations.push({
          op: group.identifier === undefined ? 'add' : 'replace',
          path: '/identifier',
          value: newIdentifierList,
        });
      }

      if (group && name !== (group.name ?? '')) {
        patchOperations.push({
          op: group.name === undefined ? 'add' : 'replace',
          path: '/name',
          value: name,
        });
      }

      const healthcareServicePatchRequest = getPatchBinary({
        resourceType: 'HealthcareService',
        resourceId: groupID,
        patchOperations,
      });

      await oystehr.fhir.transaction<HealthcareService>({
        requests: [healthcareServicePatchRequest],
      });

      enqueueSnackbar('Group saved successfully!', { variant: 'success' });
      await getOptions();
    } catch (error) {
      enqueueSnackbar('Failed to save group.', { variant: 'error' });
      console.error('Error saving group:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!group) {
    return (
      <div style={{ width: '100%', height: '250px' }}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <>
      <CustomBreadcrumbs
        chain={[
          { link: '/admin', state: { defaultTab: 'group' }, children: 'Admin' },
          { link: '/admin/schedules', state: { defaultTab: 'group' }, children: 'Schedules' },
          { link: '#', children: group.name || <Skeleton width={150} /> },
        ]}
      />

      <Typography variant="h3" color="primary.dark" marginTop={1} marginBottom={1}>
        Manage the schedule for {group?.name}
      </Typography>
      <Typography variant="body1">
        Group schedule. Patients booking through this group's link see slots from every active provider at the selected
        locations, restricted to the services in the allow-list below.
      </Typography>
      <Paper sx={{ marginTop: 2, padding: 3 }}>
        <form onSubmit={onSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 0 }}>
            <Box>
              <Typography variant="h4" color="primary.dark" marginBottom={2}>
                Slug
              </Typography>
              <TextField
                label="Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                sx={{ width: '400px', mb: 2, display: 'block' }}
              />
              <TextField
                label="Permalink"
                size="small"
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value);
                }}
                sx={{ width: '250px' }}
              />
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 0.5, color: 'text.secondary', fontFamily: 'monospace' }}
              >
                e.g. /prebook/in-person?bookingOn=
                <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {slug || 'your-permalink'}
                </Box>
                &scheduleType=group
              </Typography>
            </Box>
            <Box>
              <Typography variant="h4" color="primary.dark" marginBottom={2}>
                Share booking links
              </Typography>
              <FormControl size="small" sx={{ width: 320 }}>
                <InputLabel>Assignment Mode</InputLabel>
                <Select
                  label="Assignment Mode"
                  value={assignmentMode}
                  onChange={(e) => setAssignmentMode(e.target.value as AssignmentMode)}
                >
                  <MenuItem value="anonymous">Anonymous (pooled — unassigned until claim)</MenuItem>
                  <MenuItem value="provider">Provider (assigned at book time)</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                <strong>Anonymous</strong>: booking round-robin-picks a member and writes them to the Appointment only.
                The EHR shows the visit unassigned until front-desk confirms.
                <br />
                <strong>Provider</strong>: booking writes the picked provider directly to the Encounter. The EHR shows
                them as the attending immediately.
              </Typography>
              <Box
                sx={{ display: bookingLinks.length > 0 ? 'flex' : 'none', flexDirection: 'column', gap: 0.5, mt: 3 }}
              >
                {bookingLinks.map((link) => (
                  <Box key={link.url} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Tooltip
                      title={copiedLink === link.url ? 'Link copied!' : 'Copy link'}
                      placement="top"
                      arrow
                      onClose={() => {
                        setTimeout(() => {
                          if (copiedLink === link.url) setCopiedLink(null);
                        }, 200);
                      }}
                    >
                      <Button
                        onClick={() => {
                          void navigator.clipboard.writeText(link.url);
                          setCopiedLink(link.url);
                        }}
                        sx={{ p: 0, minWidth: 0 }}
                      >
                        <ContentCopyRoundedIcon fontSize="small" />
                      </Button>
                    </Tooltip>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {link.label}
                      </Typography>
                      <Link to={link.url} target="_blank">
                        <Typography variant="body2">{link.url}</Typography>
                      </Link>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
            <Box>
              <Typography variant="h4" color="primary.dark" marginBottom={2}>
                Services this group supports
              </Typography>
              <Typography variant="body1" sx={{ display: 'block', mb: 1, color: 'text.primary' }}>
                The patient is allowed to book only the checked services through this group's link. Each row shows which
                selected locations currently offer the service.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxWidth: 640 }}>
                {Array.from(categoryByHsId.entries())
                  .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                  .map(([hsId, info]) => {
                    const isInAllowList = supportedCategoryHsIds.includes(hsId);
                    // Selected locations where at least one active PR offers this
                    // category. When `allLocations` is on, walk every Location.
                    const targetLocationIdSet = allLocations
                      ? new Set((locations || []).map((l) => l.id).filter((id): id is string => !!id))
                      : new Set(selectedLocationIds);
                    const offeringLocationNames = new Set<string>();
                    for (const role of practitionerRoles || []) {
                      if (role.active === false) continue;
                      const offers = role.healthcareService?.some(
                        (ref) => ref.reference === `HealthcareService/${hsId}`
                      );
                      if (!offers) continue;
                      for (const locRef of role.location || []) {
                        const locId = locRef.reference?.split('/')[1];
                        if (!locId || !targetLocationIdSet.has(locId)) continue;
                        const loc = (locations || []).find((l) => l.id === locId);
                        if (loc?.name) offeringLocationNames.add(loc.name);
                      }
                    }
                    const locationsText =
                      targetLocationIdSet.size === 0
                        ? 'no locations selected'
                        : offeringLocationNames.size > 0
                        ? Array.from(offeringLocationNames).sort().join(', ')
                        : 'no selected location offers this service';
                    const isWarning = isInAllowList && targetLocationIdSet.size > 0 && offeringLocationNames.size === 0;
                    return (
                      <Box
                        key={hsId}
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1,
                          py: 0.5,
                        }}
                      >
                        <Checkbox
                          checked={isInAllowList}
                          sx={{ p: 0.5, mt: 0.25 }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSupportedCategoryHsIds([...supportedCategoryHsIds, hsId]);
                            } else {
                              setSupportedCategoryHsIds(supportedCategoryHsIds.filter((x) => x !== hsId));
                            }
                          }}
                        />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {info.name}
                            <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
                              ({info.durationMinutes} min)
                            </Typography>
                          </Typography>
                          <Typography variant="caption" sx={{ color: isWarning ? 'warning.main' : 'text.secondary' }}>
                            {locationsText}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                {categoryByHsId.size === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No services defined yet. Create them in Admin → Services.
                  </Typography>
                )}
              </Box>
              <Typography variant="h4" color="primary.dark" marginBottom={2} marginTop={2}>
                Members
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', mt: 2, mb: 2 }}>
                Selecting a Location pools every qualified provider's schedule at that Location.
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox checked={allLocations} onChange={(e) => setAllLocations(e.target.checked)} size="small" />
                }
                label="Pool from all locations"
                sx={{ mb: 1 }}
              />
              <Autocomplete
                multiple
                disableCloseOnSelect
                size="small"
                disabled={allLocations}
                sx={{ width: 640, mb: 2 }}
                options={sortedLocationIds}
                value={selectedLocationIds}
                onChange={(_e, v) => setSelectedLocationIds(v)}
                isOptionEqualToValue={(option, v) => option === v}
                getOptionLabel={(id) => {
                  const loc = (locations || []).find((l) => l.id === id);
                  return loc?.name || id;
                }}
                renderOption={(props, id) => {
                  const loc = (locations || []).find((l) => l.id === id);
                  const selected = selectedLocationIds.includes(id);
                  const providerCount = providerCountByLocationId.get(id) ?? 0;
                  const subtext =
                    providerCount === 0
                      ? 'no active providers'
                      : `${providerCount} active provider${providerCount === 1 ? '' : 's'}`;
                  return (
                    <li {...props} key={id}>
                      <Checkbox
                        icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                        checkedIcon={<CheckBoxIcon fontSize="small" />}
                        style={{ marginRight: 8 }}
                        checked={selected}
                      />
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="body2">{loc?.name || id}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {subtext}
                        </Typography>
                      </Box>
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Group Locations"
                    placeholder={selectedLocationIds.length === 0 ? 'Add a location…' : ''}
                  />
                )}
              />
              {locationProviderRollup.length > 0 && (
                <Box
                  sx={{
                    mt: 1,
                    maxWidth: 640,
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                    Providers per location
                  </Typography>
                  <Box sx={{ maxHeight: 280, overflow: 'auto', pr: 1 }}>
                    {locationProviderRollup.map((row) => (
                      <Box key={row.locationId} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {row.locationName}
                        </Typography>
                        {row.providers.length === 0 ? (
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontStyle: 'italic', ml: 1, display: 'block' }}
                          >
                            No providers at this location offer this group's services.
                          </Typography>
                        ) : (
                          row.providers.map((p) => (
                            <Typography
                              key={p.id}
                              variant="caption"
                              sx={{ color: 'text.secondary', display: 'block', ml: 1 }}
                            >
                              {p.scheduleId ? <Link to={`/admin/schedule/id/${p.scheduleId}`}>{p.name}</Link> : p.name}
                              {' — '}
                              {p.services.join(', ')}
                            </Typography>
                          ))
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
            <Box>
              <LoadingButton loading={loading} type="submit" variant="contained" color="primary" size="medium">
                Save
              </LoadingButton>
            </Box>
          </Box>
        </form>
      </Paper>
    </>
  );
}
