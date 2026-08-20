import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService, Location, PractitionerRole } from 'fhir/r4b';
import { SERVICE_CATEGORY_SYSTEM, SLUG_SYSTEM } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  getGroupAllLocations,
  isPractitionerRoleMemberOfGroup,
  isServiceCategoryHealthcareService,
} from 'utils/lib/fhir/healthcareService';
import { ListProviderGroupsResponse, ProviderGroupListItem } from 'utils/lib/types/api/schedules';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';

let m2mToken: string;

const ZAMBDA_NAME = 'list-provider-groups';

// Powers the Provider groups admin list. A "group" is a HealthcareService booking
// pool (as opposed to a service-category catalog entry, which is also an HS —
// discriminated by the SERVICE_CATEGORY_TAG). For each group it summarizes WHO it
// pools (all active providers, or the providers at its `.location[]`) and WHAT
// services can be booked through it (its `.type[]` allow-list).
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response = await performEffect(oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

const performEffect = async (oystehr: Oystehr): Promise<ListProviderGroupsResponse> => {
  // Paginated fetches — a large org can exceed a single FHIR page, which would
  // silently drop groups/providers/locations from the rollup.
  const [allHealthcareServices, activeRoles, locations] = await Promise.all([
    getAllFhirSearchPages<HealthcareService>({ resourceType: 'HealthcareService', params: [] }, oystehr),
    getAllFhirSearchPages<PractitionerRole>(
      { resourceType: 'PractitionerRole', params: [{ name: 'active', value: 'true' }] },
      oystehr
    ),
    getAllFhirSearchPages<Location>({ resourceType: 'Location', params: [] }, oystehr),
  ]);

  const locationNameById = new Map<string, string>();
  const inactiveLocationIds = new Set<string>();
  for (const loc of locations) {
    if (!loc.id) continue;
    locationNameById.set(loc.id, loc.name ?? loc.id);
    if (loc.status === 'inactive') inactiveLocationIds.add(loc.id);
  }

  // Only Group HealthcareServices — the SERVICE_CATEGORY_TAG-tagged catalog
  // entries are also HSes and must be excluded.
  const groups = allHealthcareServices.filter((hs) => !isServiceCategoryHealthcareService(hs));

  const list: ProviderGroupListItem[] = groups
    .filter((group) => !!group.id)
    .map((group) => {
      const poolsAllProviders = getGroupAllLocations(group) === true;
      const groupLocationIds = (group.location ?? [])
        .map((ref) => ref.reference?.split('/')[1])
        .filter((id): id is string => !!id);

      const locationNames = poolsAllProviders ? [] : groupLocationIds.map((id) => locationNameById.get(id) ?? id);

      // Count distinct pooled providers with the canonical group-membership
      // rule (isPractitionerRoleMemberOfGroup) — the same predicate the booking
      // path uses — rather than re-deriving a partial copy here. It counts a
      // provider whose active PR belongs to the group by back-reference,
      // by a shared Location, or by the all-locations flag, and excludes
      // providers whose only tie is an inactive Location.
      const pooledProviderIds = new Set<string>();
      for (const role of activeRoles) {
        if (
          !isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: poolsAllProviders, inactiveLocationIds })
        ) {
          continue;
        }
        const practitionerId = role.practitioner?.reference?.split('/')[1];
        if (practitionerId) pooledProviderIds.add(practitionerId);
      }
      const providerCount = pooledProviderIds.size;

      // Service allow-list: the display of each SERVICE_CATEGORY_SYSTEM coding in
      // `type[]` (the update-group zambda bakes the display in). Empty => the
      // group doesn't restrict services.
      const serviceLabels = (group.type ?? [])
        .flatMap((cc) => cc.coding ?? [])
        .filter((coding) => coding.system === SERVICE_CATEGORY_SYSTEM)
        .map((coding) => coding.display)
        .filter((display): display is string => !!display);

      return {
        id: group.id!,
        name: group.name ?? 'Unnamed group',
        active: group.active !== false,
        slug: group.identifier?.find((identifier) => identifier.system === SLUG_SYSTEM)?.value,
        poolsAllProviders,
        locationNames,
        providerCount,
        serviceLabels,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { groups: list };
};
