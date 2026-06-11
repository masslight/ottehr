import Oystehr, {
  BatchInputDeleteRequest,
  BatchInputPatchRequest,
  BatchInputPostRequest,
  SearchParam,
} from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  Bundle,
  Encounter,
  HealthcareService,
  Location,
  Patient,
  Practitioner,
  PractitionerRole,
  Reference,
  RelatedPerson,
  Schedule,
  Slot,
} from 'fhir/r4b';
import { uuid } from 'short-uuid';
import {
  BookableScheduleData,
  checkResourceHasSlug,
  getGroupAllLocations,
  isValidUUID,
  MISCONFIGURED_SCHEDULING_GROUP,
  SCHEDULE_NOT_FOUND_CUSTOM_ERROR,
  SCHEDULE_NOT_FOUND_ERROR,
  ScheduleOwnerFhirResource,
  ScheduleStrategy,
  scheduleStrategyForHealthcareService,
  SLUG_SYSTEM,
  unbundleBatchPostOutput,
  walkGroupMemberPractitionerRoleSchedules,
} from 'utils';

export async function getPatientResource(patientID: string, oystehr: Oystehr): Promise<Patient> {
  const response: Patient = await oystehr.fhir.get({
    resourceType: 'Patient',
    id: patientID ?? '',
  });

  return response;
}

interface GetScheduleResponse extends BookableScheduleData {
  rootScheduleOwner: ScheduleOwnerFhirResource;
}

export async function getSchedules(
  oystehr: Oystehr,
  scheduleType: 'location' | 'provider' | 'group',
  identifier: { slug: string } | { id: string }
): Promise<GetScheduleResponse> {
  // 'provider' resolves to a PractitionerRole — a PR pins (Practitioner,
  // Location, categories) so the share-link is meaningfully scoped.
  const fhirType = (() => {
    if (scheduleType === 'location') {
      return 'Location';
    }
    if (scheduleType === 'provider') {
      return 'PractitionerRole';
    }
    return 'HealthcareService';
  })();
  const ownerLookupParam: SearchParam =
    'slug' in identifier
      ? { name: 'identifier', value: `${SLUG_SYSTEM}|${identifier.slug}` }
      : { name: '_id', value: identifier.id };
  const ownerDescriptor = 'slug' in identifier ? `slug "${identifier.slug}"` : `id "${identifier.id}"`;
  // Filter out soft-deleted owners. The EHR-side "delete schedule" flow
  // marks the owner inactive rather than hard-deleting; without this filter
  // those still resolve and vend slots. FHIR's `active` search param is
  // defined on PractitionerRole and HealthcareService but not on Location —
  // Location uses the `status` field instead, with `inactive` as the
  // dead-row value. The Oystehr FHIR server rejects unsupported params with
  // a 400, so the filter has to branch by resource type rather than be
  // applied uniformly.
  const ownerActiveFilter: SearchParam =
    fhirType === 'Location' ? { name: 'status:not', value: 'inactive' } : { name: 'active:not', value: 'false' };
  const searchParams: SearchParam[] = [
    ownerLookupParam,
    { name: '_revinclude', value: `Schedule:actor:${fhirType}` },
    ownerActiveFilter,
  ];

  let resourceType;
  if (scheduleType === 'location') {
    resourceType = 'Location';
  } else if (scheduleType === 'provider') {
    resourceType = 'PractitionerRole';
  } else if (scheduleType === 'group') {
    resourceType = 'HealthcareService';
  } else {
    throw new Error('resourceType is not expected');
  }

  if (scheduleType === 'provider') {
    // Pull in the PR's Practitioner + Location so downstream code has the
    // resources to render a meaningful name + address without a follow-up
    // FHIR roundtrip.
    searchParams.push(
      { name: '_include', value: 'PractitionerRole:practitioner' },
      { name: '_include', value: 'PractitionerRole:location' }
    );
  }

  if (scheduleType === 'group') {
    searchParams.push(
      {
        name: '_include',
        value: 'HealthcareService:location',
      },
      {
        name: '_revinclude',
        value: 'PractitionerRole:service',
      },
      {
        name: '_include:iterate',
        value: 'PractitionerRole:practitioner',
      },
      {
        name: '_revinclude:iterate',
        value: 'HealthcareService:location',
      },
      {
        name: '_include:iterate',
        value: 'PractitionerRole:service',
      },
      // Also pull in PRs whose .location references one of the group's
      // Locations (additive to the .healthcareService back-reference path
      // above). This is the location-based pooling for `pools-providers`
      // groups whose membership is defined by Locations rather than by
      // direct PR back-references.
      { name: '_revinclude:iterate', value: 'PractitionerRole:location' },
      { name: '_revinclude:iterate', value: 'Schedule:actor:Location' },
      // Pull in any Schedule whose actor is one of the PractitionerRoles we
      // included above — the per-provider schedule lives on a PractitionerRole.
      { name: '_revinclude:iterate', value: 'Schedule:actor:PractitionerRole' }
    );
  }

  console.log('searching for resource with search params: ', searchParams);
  // Drop soft-deleted Schedule, Practitioner, and PractitionerRole resources
  // at the bundle level. Each represents a distinct "deactivate this" toggle
  // surfaced in the EHR: Schedule.active = Schedules > General toggle for
  // the schedule resource itself; Practitioner.active = Employees > Provider
  // details (the human can't take bookings anywhere); PractitionerRole.active
  // = per-(provider, location, services) toggle (the same human may be
  // active at one Location and inactive at another). The PR filter is
  // partially redundant with the FHIR search-level `active:not=false` filter
  // for the provider-scheduleType case but is essential for the group case,
  // where PRs arrive via `_revinclude` and aren't constrained by the
  // primary's filter. Filtering uniformly here means every downstream
  // consumer of `scheduleResources` — including `scheduleList` for slot
  // vending — sees only active records. `r.active === undefined` is treated
  // as active per FHIR convention.
  const isBundleResourceActive = (r: { resourceType: string; active?: boolean }): boolean => {
    // PractitionerRole.active is the per-(provider, location, services)
    // toggle (Schedules > General "Active" switch). A PR can be active
    // while a sibling PR for the same Practitioner at a different Location
    // is inactive — we want only the active ones to surface. Inactive PRs
    // arrive here via `_revinclude` (group case) or the primary search
    // (provider case is already covered by the search-level filter, but
    // the in-code check is redundant-safe).
    if (r.resourceType === 'Schedule' || r.resourceType === 'Practitioner' || r.resourceType === 'PractitionerRole') {
      return r.active !== false;
    }
    return true;
  };
  const scheduleResources = (
    await oystehr.fhir.search<Location | Practitioner | HealthcareService | Schedule | PractitionerRole>({
      resourceType: resourceType as 'Location' | 'Practitioner' | 'HealthcareService' | 'Schedule' | 'PractitionerRole',
      params: searchParams,
    })
  )
    .unbundle()
    .filter(isBundleResourceActive);

  const scheduleOwner = scheduleResources.find((res) => {
    if (res.resourceType !== fhirType) return false;
    return 'slug' in identifier ? checkResourceHasSlug(res, identifier.slug) : res.id === identifier.id;
  }) as Location | Practitioner | HealthcareService | PractitionerRole;

  let hsSchedulingStrategy: ScheduleStrategy | undefined;
  if (scheduleOwner?.resourceType === 'HealthcareService') {
    hsSchedulingStrategy = scheduleStrategyForHealthcareService(scheduleOwner as HealthcareService);
  }
  if (hsSchedulingStrategy === undefined && scheduleOwner?.resourceType === 'HealthcareService') {
    throw MISCONFIGURED_SCHEDULING_GROUP(
      `HealthcareService/${scheduleOwner?.id} needs to be configured with a scheduling strategy in order to be used as a schedule provider.`
    );
  }

  if (scheduleOwner === undefined) {
    throw SCHEDULE_NOT_FOUND_ERROR;
  }

  if (scheduleResources.length === 0) {
    console.log(`schedule for ${fhirType} with ${ownerDescriptor} was not found`);
    throw SCHEDULE_NOT_FOUND_ERROR;
  }

  // Provider booking URL: the PR resolved as the owner (its own active
  // state was already enforced by the FHIR `active:not=false` filter
  // above), but a PR has a parent Practitioner — the actual human — and
  // that Practitioner may have been deactivated independently via
  // Employees > Provider details. The Practitioner reference is `_include`d
  // in the initial search; if it's not in `scheduleResources` after the
  // bundle-level active filter, the human is inactive and the URL should
  // behave as "no schedule." Location and HealthcareService owners are
  // self-contained — their own status/active is already enforced by the
  // FHIR search filter at the top of this function — and group members'
  // active-Practitioner state is enforced in the walker branch below.
  if (scheduleOwner?.resourceType === 'PractitionerRole') {
    const pr = scheduleOwner as PractitionerRole;
    const practitionerId = pr.practitioner?.reference?.split('/')[1];
    const practitionerActive = practitionerId
      ? scheduleResources.some((r) => r.resourceType === 'Practitioner' && r.id === practitionerId)
      : false;
    if (!practitionerActive) {
      throw SCHEDULE_NOT_FOUND_ERROR;
    }
  }

  // If the group is flagged as "all locations," widen the bundle with every
  // active PractitionerRole + their Practitioners + their Schedules. The
  // poolsProviders branch below then accepts any PR (regardless of whether
  // it back-references this group or sits at one of the group's Locations).
  const allLocationsFlag =
    scheduleOwner?.resourceType === 'HealthcareService' &&
    getGroupAllLocations(scheduleOwner as HealthcareService) === true;
  if (allLocationsFlag) {
    const widened = (
      await oystehr.fhir.search<PractitionerRole | Practitioner | Schedule>({
        resourceType: 'PractitionerRole',
        params: [
          { name: 'active', value: 'true' },
          { name: '_include', value: 'PractitionerRole:practitioner' },
          { name: '_revinclude', value: 'Schedule:actor:PractitionerRole' },
          { name: '_count', value: '1000' },
        ],
      })
    )
      .unbundle()
      // Same inactive-Schedule and inactive-Practitioner filter as the
      // initial bundle; the widened search doesn't gate on either field and
      // would otherwise leak soft-deleted records back into scheduleList.
      .filter(isBundleResourceActive);
    // Dedup by `${resourceType}/${id}` so we don't double-count resources
    // that were already pulled in by the initial search's _include chains.
    const seen = new Set(scheduleResources.map((r) => `${r.resourceType}/${r.id}`));
    for (const r of widened) {
      const key = `${r.resourceType}/${r.id}`;
      if (!seen.has(key)) {
        scheduleResources.push(r);
        seen.add(key);
      }
    }
  }

  // Inactive Schedules were already dropped from scheduleResources above;
  // no per-find active check needed here.
  const schedule = scheduleResources.find((res) => {
    return res.resourceType === 'Schedule' && res.actor?.[0]?.reference === `${fhirType}/${scheduleOwner.id}`;
  }) as Schedule | undefined;

  //const schedule: Location | Practitioner | HealthcareService = scheduleResources[0];

  if (!schedule?.id && (hsSchedulingStrategy === undefined || hsSchedulingStrategy === ScheduleStrategy.owns)) {
    throw SCHEDULE_NOT_FOUND_CUSTOM_ERROR(
      `No Schedule associated with ${fhirType} with ${ownerDescriptor} could be found. To cure this, create a Schedule resource referencing this ${fhirType} resource via its "actor" field and give it an extension with the requisite schedule extension json.`
    );
  }

  const practitioners: Practitioner[] = [];
  const schedules: Schedule[] = [];
  const locations: Location[] = [];

  scheduleResources.forEach((res) => {
    if (res.resourceType === 'Practitioner') {
      practitioners.push(res);
    }
    if (res.resourceType === 'Schedule') {
      schedules.push(res);
    }
    if (res.resourceType === 'Location') {
      locations.push(res);
    }
  });

  const scheduleList: BookableScheduleData['scheduleList'] = [];
  if (hsSchedulingStrategy === ScheduleStrategy.poolsAll || hsSchedulingStrategy === ScheduleStrategy.poolsProviders) {
    // Legacy Practitioner-actored Schedules: still supported inline. No
    // current caller produces these via the slot-vending path, but the
    // legacy schedules in older deployments may still be PR-less.
    const practitioners: Practitioner[] = [];
    const schedules: Schedule[] = [];
    scheduleResources.forEach((res) => {
      if (res.resourceType === 'Practitioner') practitioners.push(res);
      if (res.resourceType === 'Schedule') schedules.push(res);
    });
    schedules.forEach((scheduleObj) => {
      const owner = scheduleObj.actor[0]?.reference ?? '';
      const [ownerResourceType, ownerId] = owner.split('/');
      if (ownerResourceType !== 'Practitioner' || !ownerId) return;
      const practitioner = practitioners.find((p) => p.id === ownerId);
      if (practitioner) scheduleList.push({ schedule: scheduleObj, owner: practitioner });
    });

    // PR-actored Schedules: factored into the shared walker so the
    // membership rules (back-reference / location-overlap / all-locations)
    // are defined once and reusable by other callers — see
    // getGroupMemberPractitionerRoleSchedules below for the focused-query
    // entry point used by create-appointment's fallback.
    const memberPairs = walkGroupMemberPractitionerRoleSchedules({
      bundle: scheduleResources,
      group: scheduleOwner as HealthcareService,
    });
    // Drop member pairs whose PR references a Practitioner that's been
    // filtered out (i.e., Practitioner.active === false from Employees >
    // Provider details). The walker matches by PR id and doesn't see the
    // Practitioner; that check belongs here, where the bundle filter has
    // already produced the active-Practitioners set.
    const activePractitionerIds = new Set<string>();
    for (const r of scheduleResources) {
      if (r.resourceType === 'Practitioner' && r.id) activePractitionerIds.add(r.id);
    }
    for (const { schedule: sched, role } of memberPairs) {
      const pId = role.practitioner?.reference?.split('/')[1];
      if (!pId || !activePractitionerIds.has(pId)) continue;
      scheduleList.push({ schedule: sched, owner: role });
    }
  }

  // todo: there's clearly a generic func to be extracted here...
  if (hsSchedulingStrategy === ScheduleStrategy.poolsAll || hsSchedulingStrategy === ScheduleStrategy.poolsLocations) {
    const locations: Location[] = [];
    const schedules: Schedule[] = [];

    scheduleResources.forEach((res) => {
      if (res.resourceType === 'Location') {
        locations.push(res);
      }
      if (res.resourceType === 'Schedule') {
        schedules.push(res);
      }
    });

    schedules.forEach((scheduleObj) => {
      const owner = scheduleObj.actor[0]?.reference ?? '';
      const [ownerResourceType, ownerId] = owner.split('/');
      if (ownerResourceType === 'Location' && ownerId) {
        const location = locations.find((loc) => {
          return loc.id === ownerId;
        });
        if (location) {
          scheduleList.push({
            schedule: scheduleObj,
            owner: location,
          });
        }
      }
    });
  }

  if (hsSchedulingStrategy === undefined || hsSchedulingStrategy === ScheduleStrategy.owns) {
    const matchingSchedules = schedules.filter((res) => {
      return res.actor?.[0]?.reference === `${scheduleOwner.resourceType}/${scheduleOwner.id}`;
    });
    scheduleList.push(...matchingSchedules.map((scheduleObj) => ({ schedule: scheduleObj, owner: scheduleOwner })));
  }

  return {
    metadata: {
      type: scheduleType,
      strategy: hsSchedulingStrategy,
    },
    scheduleList,
    rootScheduleOwner: scheduleOwner, // this probable isn't needed. just the ref can go in metadata
  };
}

/**
 * Returns the (Schedule, PractitionerRole) pairs that make up a `pools-
 * providers` group's member set. Lighter than `getSchedules` — no
 * BookableScheduleData metadata aggregation, no scheduling-strategy
 * branching, no slug-or-id owner dispatch. The query is focused on the
 * minimum bundle needed for membership resolution: the group HS, its
 * Locations, PRs reachable via `.service` back-ref or `.location` overlap,
 * and Schedules actored by those PRs.
 *
 * Used by the create-appointment fallback (groupMemberFallback.ts), which
 * needs the bare member list and would otherwise pay for the full
 * slot-vending query that `getSchedules` does. Membership rules and the
 * actor-walking logic live in `walkGroupMemberPractitionerRoleSchedules`
 * (utils/lib/fhir/healthcareService.ts) and are shared with `getSchedules`'
 * pools-providers branch above — single source of truth.
 */
export async function getGroupMemberPractitionerRoleSchedules(
  oystehr: Oystehr,
  group: HealthcareService
): Promise<{ schedule: Schedule; role: PractitionerRole }[]> {
  if (!group.id) return [];
  const allLocationsFlag = getGroupAllLocations(group) === true;

  const bundle = (
    await oystehr.fhir.search<HealthcareService | Location | PractitionerRole | Schedule>({
      resourceType: 'HealthcareService',
      params: [
        { name: '_id', value: group.id },
        { name: '_include', value: 'HealthcareService:location' },
        { name: '_revinclude:iterate', value: 'PractitionerRole:service' },
        { name: '_revinclude:iterate', value: 'PractitionerRole:location' },
        { name: '_revinclude:iterate', value: 'Schedule:actor:PractitionerRole' },
      ],
    })
  ).unbundle();

  // All-locations widening: pull every active PR + their Schedules into the
  // bundle so the walker's `isMemberByAllLocations` branch has the candidates
  // to match against. Mirrors the same widening getSchedules does for
  // group-type lookups when the flag is set.
  if (allLocationsFlag) {
    const widened = (
      await oystehr.fhir.search<PractitionerRole | Schedule>({
        resourceType: 'PractitionerRole',
        params: [
          { name: 'active', value: 'true' },
          { name: '_revinclude', value: 'Schedule:actor:PractitionerRole' },
          { name: '_count', value: '1000' },
        ],
      })
    ).unbundle();
    const seen = new Set(bundle.map((r) => `${r.resourceType}/${r.id}`));
    for (const r of widened) {
      const key = `${r.resourceType}/${r.id}`;
      if (!seen.has(key)) {
        bundle.push(r);
        seen.add(key);
      }
    }
  }

  return walkGroupMemberPractitionerRoleSchedules({ bundle, group });
}

export async function updatePatientResource(
  patientId: string,
  patchOperations: Operation[],
  oystehr: Oystehr
): Promise<Patient> {
  try {
    const response: Patient = await oystehr.fhir.patch({
      resourceType: 'Patient',
      id: patientId,
      operations: patchOperations,
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to update Patient: ${JSON.stringify(error)}`);
  }
}

// todo maybe refactor use case to use patchAppt instead and get rid of this and rename above
export async function updateAppointmentTime(
  appointment: Appointment,
  startTime: string,
  endTime: string,
  oystehr: Oystehr,
  slot?: Slot
): Promise<Appointment> {
  try {
    const currentSlotRef = appointment?.slot?.[0]?.reference;
    let newSlotReference: Reference | undefined;
    const patchSlotRequests: BatchInputPatchRequest<Slot>[] = [];
    const deleteSlotRequests: BatchInputDeleteRequest[] = [];
    const postSlotRequests: BatchInputPostRequest<Slot>[] = [];
    if (slot && `Slot/${slot.id}` !== currentSlotRef) {
      // we need to update the Appointment with the passed in Slot
      if (isValidUUID(slot?.id ?? '') && slot?.meta !== undefined) {
        // assume slot already persisted
        newSlotReference = {
          reference: `Slot/${slot.id}`,
        };
        patchSlotRequests.push({
          method: 'PATCH',
          url: `Slot/${slot.id}`,
          operations: [
            {
              op: 'replace',
              path: '/status',
              value: 'busy',
            },
          ],
        });
        const currenSlotId = currentSlotRef?.split('/')[1];
        if (currenSlotId) {
          deleteSlotRequests.push({
            method: 'DELETE',
            url: `Slot/${currentSlotRef?.split('/')[1]}`,
          });
        }
      } else if (slot) {
        postSlotRequests.push({
          method: 'POST',
          url: '/Slot',
          resource: {
            ...slot,
            resourceType: 'Slot',
            id: undefined,
            status: 'busy',
          },
          fullUrl: `urn:uuid:${uuid()}`,
        });
        newSlotReference = {
          reference: postSlotRequests[0].fullUrl,
        };
      }
    }

    const slotRefOps: Operation[] = [];
    if (newSlotReference) {
      slotRefOps.push({
        op: appointment.slot === undefined ? 'add' : 'replace',
        path: '/slot',
        value: [newSlotReference],
      });
    }

    const patchRequest: BatchInputPatchRequest<Appointment> = {
      method: 'PATCH',
      url: `Appointment/${appointment.id}`,
      operations: [
        {
          op: 'replace',
          path: '/start',
          value: startTime,
        },
        {
          op: 'replace',
          path: '/end',
          value: endTime,
        },
        ...slotRefOps,
      ],
    };
    const json = await oystehr.fhir.transaction<Appointment | Slot>({
      requests: [...postSlotRequests, patchRequest, ...patchSlotRequests, ...deleteSlotRequests],
    });
    const flattened = unbundleBatchPostOutput<Appointment | Slot>(json);
    const apt = flattened.find((res): res is Appointment => res.resourceType === 'Appointment');
    if (!apt) {
      throw new Error('Appointment not returned in bundle');
    }
    return apt;
  } catch (error: unknown) {
    throw new Error(`Failed to update Appointment: ${JSON.stringify(error)}`);
  }
}

export async function searchInvitedParticipantResourcesByEncounterId(
  encounterId: string,
  oystehr: Oystehr
): Promise<RelatedPerson[]> {
  const allResources = (
    await oystehr.fhir.search<Encounter | RelatedPerson>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:participant',
        },
      ],
    })
  ).unbundle();

  const relatedPersons: RelatedPerson[] = allResources.filter(
    (r): r is RelatedPerson => r.resourceType === 'RelatedPerson'
  );
  return relatedPersons.filter((r) => r.relationship?.[0].coding?.[0].code === 'WIT');
}

export async function fetchAllPages(
  fetchPage: (offset: number, count: number) => Promise<Bundle>,
  initialPageSize: number
): Promise<void> {
  let offset = 0;
  let pageSize = initialPageSize;
  let hasMorePages = true;
  do {
    let bundle;
    let pageFetched = false;
    while (!pageFetched && pageSize > 0) {
      try {
        bundle = await fetchPage(offset, pageSize);
        pageFetched = true;
      } catch (error: unknown) {
        console.log(`Error fetching page: ${error}`, JSON.stringify(error));
        if (error instanceof Oystehr.OystehrSdkError && (error.code === 4130 || (error.code as any) === '4130')) {
          pageSize = Math.floor(pageSize / 2);
        } else {
          throw error;
        }
      }
    }
    if (pageSize === 0) {
      throw new Error('Failed to fetch resources');
    }
    hasMorePages = bundle?.link?.find((link) => link.relation === 'next') != null;
    offset += pageSize;

    // Safety check
    if (offset > 100000) {
      console.warn('Reached maximum pagination limit (100000 items). Stopping search.');
      break;
    }
  } while (hasMorePages);
}
