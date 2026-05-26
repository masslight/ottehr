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
import { BatchInputRequest } from '@oystehr/sdk';
import { useQuery } from '@tanstack/react-query';
import { Operation } from 'fast-json-patch';
import { CodeableConcept, HealthcareService, Location, Practitioner, PractitionerRole, Resource } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listServiceCategories } from 'src/api/api';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import {
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
  // Two membership levers, both valid and composable. Location-based
  // membership expands each selected Location into the PR-schedules at
  // that Location via the `pools-providers` strategy. Per-PR membership
  // adds individual PR-schedules to the pool by back-reference. A group
  // can use either, both, or neither; selections from the two pickers
  // union at slot-resolution time (dedup is keyed by Schedule).
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
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

  // Picker order: Locations with at least one active provider come first,
  // then Locations with none. Within each tier, sort alphabetically
  // ascending by Location name.
  const sortedLocationIds = useMemo(() => {
    const nameById = new Map((locations || []).filter((l) => l.id).map((l) => [l.id!, l.name || ''] as const));
    return (locations || [])
      .map((l) => l.id)
      .filter((id): id is string => !!id)
      .sort((a, b) => {
        const aHas = (providerCountByLocationId.get(a) ?? 0) > 0;
        const bHas = (providerCountByLocationId.get(b) ?? 0) > 0;
        if (aHas !== bHas) return aHas ? -1 : 1;
        return (nameById.get(a) ?? '').localeCompare(nameById.get(b) ?? '');
      });
  }, [locations, providerCountByLocationId]);

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
    // Query PractitionerRoles directly (with their referenced Practitioners
    // _included). Earlier this came in via Practitioner?_revinclude, but that
    // pages on the Practitioner count — at 307 practitioners only the first 50
    // had their PRs returned, hiding any provider beyond that page.
    const request = await oystehr.fhir.batch({
      requests: [
        { method: 'GET', url: `/HealthcareService?_id=${groupID}` },
        { method: 'GET', url: '/Location?_count=1000' },
        { method: 'GET', url: '/PractitionerRole?_include=PractitionerRole:practitioner&_count=1000' },
      ],
    });
    const groupTemp: HealthcareService = (request?.entry?.[0]?.resource as any).entry.map(
      (resourceTemp: any) => resourceTemp.resource
    )[0];
    const locationsTemp: Location[] = (request?.entry?.[1]?.resource as any).entry.map(
      (resourceTemp: any) => resourceTemp.resource
    );
    const practitionerResources: Resource[] = (request?.entry?.[2]?.resource as any).entry.map(
      (resourceTemp: any) => resourceTemp.resource
    );
    const practitionersTemp: Practitioner[] = practitionerResources.filter(
      (r) => r.resourceType === 'Practitioner'
    ) as Practitioner[];
    const practitionerRolesTemp: PractitionerRole[] = practitionerResources.filter(
      (r) => r.resourceType === 'PractitionerRole'
    ) as PractitionerRole[];

    setGroup(groupTemp);
    setName(groupTemp.name ?? '');
    setSlug(getSlugForBookableResource(groupTemp) ?? '');
    setLocations(locationsTemp);
    setPractitioners(practitionersTemp);
    setPractitionerRoles(practitionerRolesTemp);

    // Pre-select any PR that already references this group via .healthcareService[].
    const initialSelectedRoleIds = practitionerRolesTemp
      .filter((role) => role.healthcareService?.some((ref) => ref.reference === `HealthcareService/${groupTemp.id}`))
      .map((role) => role.id!)
      .filter((id) => !!id);
    setSelectedRoleIds(initialSelectedRoleIds);

    // Pre-select the group's currently-attached Locations.
    const initialSelectedLocationIds = (groupTemp.location ?? [])
      .map((ref) => ref.reference?.split('/')[1])
      .filter((id): id is string => !!id);
    setSelectedLocationIds(initialSelectedLocationIds);

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
      if (!oystehr || !practitionerRoles) return;
      setLoading(true);

      // Previously-selected role ids (those with a healthcareService ref to us).
      const wasSelected = new Set(
        practitionerRoles
          .filter((r) => r.healthcareService?.some((ref) => ref.reference === `HealthcareService/${groupID}`))
          .map((r) => r.id!)
      );
      const nowSelected = new Set(selectedRoleIds);
      const toAdd = selectedRoleIds.filter((id) => !wasSelected.has(id));
      const toRemove = Array.from(wasSelected).filter((id) => !nowSelected.has(id));

      const rolePatchRequests: BatchInputRequest<PractitionerRole>[] = [];
      for (const roleId of toAdd) {
        const role = practitionerRoles.find((r) => r.id === roleId);
        if (!role) continue;
        let value: any = { reference: `HealthcareService/${groupID}` };
        if (!role.healthcareService) value = [value];
        rolePatchRequests.push(
          getPatchBinary({
            resourceType: 'PractitionerRole',
            resourceId: roleId,
            patchOperations: [
              {
                op: 'add',
                path: role.healthcareService ? '/healthcareService/-' : '/healthcareService',
                value,
              },
            ],
          })
        );
      }
      for (const roleId of toRemove) {
        const role = practitionerRoles.find((r) => r.id === roleId);
        if (!role) continue;
        const filtered = (role.healthcareService || []).filter(
          (ref) => ref.reference !== `HealthcareService/${groupID}`
        );
        rolePatchRequests.push(
          getPatchBinary({
            resourceType: 'PractitionerRole',
            resourceId: roleId,
            patchOperations: [{ op: 'replace', path: '/healthcareService', value: filtered }],
          })
        );
      }

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

      await oystehr.fhir.transaction<PractitionerRole | HealthcareService>({
        requests: [...rolePatchRequests, healthcareServicePatchRequest],
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

  // Selected PRs that have since been deactivated. These linger as group
  // members until an admin deselects them — surface a warning so the cleanup
  // is obvious.
  const selectedInactiveRoles = (practitionerRoles || []).filter(
    (r) => r.id && selectedRoleIds.includes(r.id) && r.active === false
  );

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
        This is a group schedule. Its availability is made up of the schedules of the provider roles selected below.
        Each role carries its own Location and list of offered services; the group's offered services and locations are
        derived from that union.
      </Typography>
      {selectedInactiveRoles.length > 0 && (
        <Box
          sx={{
            mt: 2,
            p: 2,
            border: '1px solid',
            borderColor: 'warning.main',
            borderRadius: 1,
            backgroundColor: 'warning.lighter',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {selectedInactiveRoles.length === 1
              ? '1 inactive provider schedule is still selected as a member.'
              : `${selectedInactiveRoles.length} inactive provider schedules are still selected as members.`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Inactive schedules don't contribute to this group's bookable hours, locations, or services. Deselect them in
            the picker below and Save to clean up.
          </Typography>
        </Box>
      )}
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
                selected members currently offer the service.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxWidth: 640 }}>
                {Array.from(categoryByHsId.entries())
                  .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                  .map(([hsId, info]) => {
                    const isInAllowList = supportedCategoryHsIds.includes(hsId);
                    // Members of this group whose PR explicitly offers this category.
                    const offeringNames: string[] = [];
                    if (practitionerRoles && practitioners) {
                      const seen = new Set<string>();
                      for (const role of practitionerRoles) {
                        if (!role.id || !selectedRoleIds.includes(role.id)) continue;
                        const offers = role.healthcareService?.some(
                          (ref) => ref.reference === `HealthcareService/${hsId}`
                        );
                        if (!offers) continue;
                        const pracId = role.practitioner?.reference?.split('/')[1];
                        const prac = practitioners.find((p) => p.id === pracId);
                        const name = prac?.name?.[0]
                          ? oystehr?.fhir.formatHumanName(prac.name[0]) || 'Unknown'
                          : 'Unknown';
                        if (!seen.has(name)) {
                          seen.add(name);
                          offeringNames.push(name);
                        }
                      }
                    }
                    const providerText =
                      offeringNames.length > 0 ? offeringNames.join(', ') : 'no member offers this service';
                    const isWarning = offeringNames.length === 0 && isInAllowList;
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
                            {providerText}
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
