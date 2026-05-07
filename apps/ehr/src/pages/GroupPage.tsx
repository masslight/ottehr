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
  Grid,
  InputLabel,
  MenuItem,
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

// HealthcareService.characteristic element is structurally an array of
// CodeableConcept. Defining locally to avoid a missing named export.
type HealthcareServiceCharacteristic = CodeableConcept;
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listServiceCategories } from 'src/api/api';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { getPatchBinary, getSlugForBookableResource, SLUG_SYSTEM } from 'utils';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

const SERVICE_CATEGORY_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/service-category';
const GROUP_ASSIGNMENT_MODE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/group-assignment-mode';
const GROUP_SLOT_CADENCE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/group-slot-cadence';

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
  // The ONLY membership lever exposed to the admin now. Locations and offered
  // categories are derived from the selected roles at save time.
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('anonymous');
  // Slot cadence moved from the group to the service category. Stripping any
  // existing GROUP_SLOT_CADENCE coding on save (above) cleans up legacy data.
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
    const map = new Map<string, { code: string; name: string; durationMinutes: number }>();
    for (const sc of available) {
      if ((sc as any).id) {
        map.set((sc as any).id, {
          code: sc.code,
          name: sc.name,
          durationMinutes: (sc as any).config?.durationMinutes ?? 15,
        });
      }
    }
    return map;
  }, [categoryData]);

  // Derive the selected roles' (location × category) combinations for display
  // and for booking-link generation. Memberships are expressed solely through
  // the set of selectedRoleIds; locations and categories carried on the group's
  // HealthcareService are kept in sync at save time.
  const derivedMembership = useMemo(() => {
    // Inactive PRs (soft-deleted from the EditEmployee schedule list) shouldn't
    // contribute to the group's effective Locations / Categories — they're
    // dead schedules, not currently-bookable ones. They still appear in the
    // selector below (with an "(inactive)" marker) so an admin can deselect,
    // but they don't show up in the "Derived from group members" summary.
    const selectedRoles = (practitionerRoles || []).filter(
      (r) => r.id && selectedRoleIds.includes(r.id) && r.active !== false
    );
    const locationById = new Map<string, Location>();
    for (const loc of locations || []) if (loc.id) locationById.set(loc.id, loc);

    const locationSlugsById = new Map<string, string>();
    for (const loc of locations || []) {
      if (loc.id) {
        const locSlug = getSlugForBookableResource(loc);
        if (locSlug) locationSlugsById.set(loc.id, locSlug);
      }
    }

    const derivedLocationIds = new Set<string>();
    const derivedCategoryHsIds = new Set<string>();
    const roleRows: Array<{
      roleId: string;
      practitionerLabel: string;
      locationName: string;
      locationId: string;
      locationSlug?: string;
      categoryHsIds: string[];
    }> = [];

    for (const role of selectedRoles) {
      const locRef = role.location?.[0]?.reference;
      const locId = locRef?.split('/')[1];
      if (locId) {
        derivedLocationIds.add(locId);
      }
      const pracId = role.practitioner?.reference?.split('/')[1];
      const pracResource = (practitioners || []).find((p) => p.id === pracId);
      const practitionerLabel = pracResource?.name?.[0]
        ? oystehr?.fhir.formatHumanName(pracResource.name[0]) || 'Unknown'
        : 'Unknown';
      const locResource = locId ? locationById.get(locId) : undefined;
      const categoryHsIds = (role.healthcareService || [])
        .map((ref) => ref.reference?.split('/')[1])
        .filter((id): id is string => !!id && categoryByHsId.has(id));
      for (const id of categoryHsIds) derivedCategoryHsIds.add(id);

      roleRows.push({
        roleId: role.id!,
        practitionerLabel,
        locationName: locResource?.name || 'Unnamed location',
        locationId: locId ?? '',
        locationSlug: locId ? locationSlugsById.get(locId) : undefined,
        categoryHsIds,
      });
    }

    return {
      roleRows,
      derivedLocationIds: Array.from(derivedLocationIds),
      derivedCategoryHsIds: Array.from(derivedCategoryHsIds),
    };
  }, [selectedRoleIds, practitionerRoles, practitioners, locations, oystehr, categoryByHsId]);

  // Build booking links for (location, category) pairs present among the
  // selected roles. Category picker URL is only meaningful for a group that
  // has exactly one location and multiple categories.
  const bookingLinks = useMemo(() => {
    if (!slug) return [];
    const base = `${INTAKE_URL}/prebook/in-person`;
    const groupParams = `bookingOn=${slug}&scheduleType=group`;

    const distinctLocations = new Map<string, { id: string; name: string; slug: string }>();
    const distinctCategories = new Map<string, { code: string; name: string; durationMinutes: number }>();
    for (const row of derivedMembership.roleRows) {
      if (row.locationId && row.locationSlug && !distinctLocations.has(row.locationId)) {
        distinctLocations.set(row.locationId, { id: row.locationId, name: row.locationName, slug: row.locationSlug });
      }
      for (const hsId of row.categoryHsIds) {
        const cat = categoryByHsId.get(hsId);
        if (cat && !distinctCategories.has(cat.code)) distinctCategories.set(cat.code, cat);
      }
    }
    const locs = Array.from(distinctLocations.values());
    const cats = Array.from(distinctCategories.values());

    const links: Array<{ label: string; url: string }> = [];
    if (locs.length === 1 && cats.length >= 2) {
      links.push({
        label: `Category picker — ${locs[0].name}`,
        url: `${base}/select-service-category?${groupParams}&atLocation=${encodeURIComponent(locs[0].slug)}`,
      });
    }
    for (const loc of locs) {
      for (const cat of cats) {
        links.push({
          label: `${loc.name} · ${cat.name} — ${cat.durationMinutes} min`,
          url: `${base}?${groupParams}&serviceCategory=${encodeURIComponent(cat.code)}&atLocation=${encodeURIComponent(
            loc.slug
          )}`,
        });
      }
    }
    return links;
  }, [slug, derivedMembership, categoryByHsId]);

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
    setSlug(getSlugForBookableResource(groupTemp) ?? '');
    setLocations(locationsTemp);
    setPractitioners(practitionersTemp);
    setPractitionerRoles(practitionerRolesTemp);

    // Pre-select any role that already references this group.
    const initialSelectedRoleIds = practitionerRolesTemp
      .filter((role) => role.healthcareService?.some((ref) => ref.reference === `HealthcareService/${groupTemp.id}`))
      .map((role) => role.id!)
      .filter((id) => !!id);
    setSelectedRoleIds(initialSelectedRoleIds);

    const modeCoding = (groupTemp.characteristic || [])
      .flatMap((c) => c.coding || [])
      .find((c) => c.system === GROUP_ASSIGNMENT_MODE_SYSTEM);
    setAssignmentMode((modeCoding?.code as AssignmentMode) || 'anonymous');
  }, [oystehr, groupID]);

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

      // Derive the group's declared locations and offered categories from the
      // currently-selected roles. Keeps downstream readers (tracking board
      // filter, URL generators) consistent without requiring manual upkeep.
      const derivedLocationRefs = derivedMembership.derivedLocationIds.map((id) => ({
        reference: `Location/${id}`,
      }));
      const derivedTypes: CodeableConcept[] = derivedMembership.derivedCategoryHsIds
        .map((hsId) => categoryByHsId.get(hsId))
        .filter((x): x is { code: string; name: string; durationMinutes: number } => !!x)
        .map((cat) => ({
          coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: cat.code, display: cat.name }],
          text: cat.name,
        }));

      const patchOperations: Operation[] = [
        { op: group?.location ? 'replace' : 'add', path: '/location', value: derivedLocationRefs },
        { op: group?.type ? 'replace' : 'add', path: '/type', value: derivedTypes },
      ];

      // Slot cadence used to live on the group as GROUP_SLOT_CADENCE_SYSTEM but
      // moved to the service category (ServiceCategoryRuntimeConfig.cadenceMinutes).
      // We strip any legacy cadence coding here so saving the group cleans it
      // up, but we no longer write a new cadence characteristic.
      const OWNED_SYSTEMS = new Set([GROUP_ASSIGNMENT_MODE_SYSTEM, GROUP_SLOT_CADENCE_SYSTEM]);
      const preservedCharacteristics: HealthcareServiceCharacteristic[] = (group?.characteristic || [])
        .map((c) => ({
          ...c,
          coding: (c.coding || []).filter((code) => !OWNED_SYSTEMS.has(code.system || '')),
        }))
        .filter((c) => (c.coding || []).length > 0);
      const newCharacteristics: HealthcareServiceCharacteristic[] = [
        ...preservedCharacteristics,
        { coding: [{ system: GROUP_ASSIGNMENT_MODE_SYSTEM, code: assignmentMode }] },
      ];
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

  // Show schedule-bearing PRs (those with a Location reference); group-only
  // membership PRs without a Location aren't real schedules and would clutter
  // the picker. Already-selected roles always stay in the list so admins can
  // deselect them, even if the data shape would otherwise hide them.
  const roleOptions = (practitionerRoles || []).filter((role) => {
    if (!role.practitioner?.reference) return false;
    if (selectedRoleIds.includes(role.id!)) return true;
    return !!role.location?.[0]?.reference;
  });

  const labelForRole = (role: PractitionerRole): string => {
    const pracId = role.practitioner?.reference?.split('/')[1];
    const pracResource = (practitioners || []).find((p) => p.id === pracId);
    const pracLabel = pracResource?.name?.[0]
      ? oystehr?.fhir.formatHumanName(pracResource.name[0]) || 'Unknown provider'
      : 'Unknown provider';
    const locRef = role.location?.[0]?.reference;
    const locId = locRef?.split('/')[1];
    const locName = (locations || []).find((l) => l.id === locId)?.name;
    const inactiveSuffix = role.active === false ? ' (inactive)' : '';
    const base = locName ? `${pracLabel} @ ${locName}` : pracLabel;
    return `${base}${inactiveSuffix}`;
  };

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

      <Typography variant="h4">Manage the schedule for {group?.name}</Typography>
      <Typography variant="body1">
        This is a group schedule. Its availability is made up of the schedules of the provider roles selected below.
        Each role carries its own Location and list of offered service categories; the group's offered categories and
        locations are derived from that union.
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
            Inactive schedules don't contribute to this group's bookable hours, locations, or categories. Deselect them
            in the picker below and Save to clean up.
          </Typography>
        </Box>
      )}
      <form onSubmit={onSubmit}>
        <Grid container direction="column" spacing={4} sx={{ marginTop: 0 }}>
          <Grid item xs={6}>
            <TextField
              label="Slug"
              value={slug}
              onChange={(event) => {
                setSlug(event.target.value);
              }}
              sx={{ width: '250px' }}
            />
            <Typography variant="body2" sx={{ pt: 1, pb: 0.5, fontWeight: 600, display: slug ? 'block' : 'none' }}>
              Share booking links:
            </Typography>
            <Box sx={{ display: bookingLinks.length > 0 ? 'flex' : 'none', flexDirection: 'column', gap: 0.5, mb: 3 }}>
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
          </Grid>
          <Grid item xs={6}>
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
          </Grid>
          <Grid item xs={6}>
            <Autocomplete
              multiple
              disableCloseOnSelect
              size="small"
              sx={{ width: 640 }}
              options={roleOptions.map((r) => r.id!).filter((id) => !!id)}
              value={selectedRoleIds}
              onChange={(_e, v) => setSelectedRoleIds(v)}
              isOptionEqualToValue={(option, v) => option === v}
              getOptionLabel={(id) => {
                const role = (practitionerRoles || []).find((r) => r.id === id);
                return role ? labelForRole(role) : id;
              }}
              renderOption={(props, id) => {
                const role = (practitionerRoles || []).find((r) => r.id === id);
                const selected = selectedRoleIds.includes(id);
                return (
                  <li {...props} key={id}>
                    <Checkbox
                      icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                      checkedIcon={<CheckBoxIcon fontSize="small" />}
                      style={{ marginRight: 8 }}
                      checked={selected}
                    />
                    {role ? labelForRole(role) : id}
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Group Members (Provider Schedules)"
                  placeholder={selectedRoleIds.length === 0 ? 'Add a provider schedule…' : ''}
                />
              )}
            />
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
              Each provider schedule binds a provider to a location and a set of service categories — created from the
              Employees admin page. The group's offered service categories and locations are the union of its members'.
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Derived from group members:
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              <strong>Locations:</strong>{' '}
              {derivedMembership.roleRows.length === 0
                ? 'none'
                : Array.from(new Set(derivedMembership.roleRows.map((r) => r.locationName))).join(', ')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              <strong>Service categories:</strong>{' '}
              {derivedMembership.derivedCategoryHsIds.length === 0
                ? 'none'
                : derivedMembership.derivedCategoryHsIds.map((id) => categoryByHsId.get(id)?.name || id).join(', ')}
            </Typography>
          </Grid>
          <Grid item xs={2}>
            <LoadingButton loading={loading} type="submit" variant="contained">
              Save
            </LoadingButton>
          </Grid>
        </Grid>
      </form>
    </>
  );
}
