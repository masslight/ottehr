import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService, PractitionerRole } from 'fhir/r4b';
import { SCHEDULE_DISPLAY_NAME_EXTENSION_URL } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { checkPractitionerRoleConflict } from '../admin-practitioner-role-shared/check-conflict';

interface AdminUpdatePractitionerRoleInput {
  roleId: string;
  /** New full set of HealthcareService ids the role offers; replaces existing. */
  categoryHealthcareServiceIds?: string[];
  /** New Location id for this role. Replaces the existing location reference. */
  locationId?: string;
  /**
   * Optional admin-set display name for this schedule. Empty string clears
   * the override (callers fall back to "<Practitioner> @ <Location>"). Omit
   * the field entirely to leave the existing value untouched.
   */
  displayName?: string;
}

const ZAMBDA_NAME = 'admin-update-practitioner-role';
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw new Error('No request body provided');
  if (!input.secrets) throw new Error('No secrets provided');
  const parsed = JSON.parse(input.body) as Partial<AdminUpdatePractitionerRoleInput>;

  if (!parsed.roleId || typeof parsed.roleId !== 'string') {
    throw new Error('roleId is required');
  }
  const hasCategories = Array.isArray(parsed.categoryHealthcareServiceIds);
  const hasLocation = typeof parsed.locationId === 'string' && parsed.locationId.length > 0;
  const hasDisplayName = typeof parsed.displayName === 'string';
  if (!hasCategories && !hasLocation && !hasDisplayName) {
    throw new Error('At least one of categoryHealthcareServiceIds, locationId, or displayName must be provided');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  // Validate the resulting (provider, location, category) tuple won't collide
  // with another active PR. Need the current PR to fill in fields the caller
  // didn't supply (e.g., when only categories are being changed, the location
  // comes from the existing record).
  const currentRole = await oystehr.fhir.get<PractitionerRole>({
    resourceType: 'PractitionerRole',
    id: parsed.roleId,
  });
  const practitionerRef = currentRole.practitioner?.reference;
  const targetLocationRef = hasLocation ? `Location/${parsed.locationId}` : currentRole.location?.[0]?.reference;
  const targetCategoryIds = hasCategories
    ? parsed.categoryHealthcareServiceIds ?? []
    : (currentRole.healthcareService ?? [])
        .map((ref) => ref.reference?.split('/')[1])
        .filter((id): id is string => !!id);

  if (practitionerRef && targetLocationRef && targetCategoryIds.length > 0) {
    const categoryNameById = new Map<string, string>();
    const hsBundle = await oystehr.fhir.search<HealthcareService>({
      resourceType: 'HealthcareService',
      params: [{ name: '_id', value: targetCategoryIds.join(',') }],
    });
    for (const hs of hsBundle.unbundle()) {
      if (hs.id) categoryNameById.set(hs.id, hs.name ?? hs.id);
    }
    const conflict = await checkPractitionerRoleConflict(
      oystehr,
      {
        id: parsed.roleId,
        practitionerRef,
        locationRef: targetLocationRef,
        categoryHsIds: targetCategoryIds,
      },
      { categoryNameById }
    );
    if (conflict) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          code: 'PRACTITIONER_SCHEDULE_CONFLICT',
          message: `This provider already has another active schedule at this location offering ${conflict.conflictingCategoryNames.join(
            ', '
          )}. Remove ${
            conflict.conflictingCategoryNames.length === 1 ? 'it' : 'them'
          } from that schedule first, or pick a different location.`,
          conflictingScheduleId: conflict.conflictingScheduleId,
          conflictingCategoryNames: conflict.conflictingCategoryNames,
        }),
      };
    }
  }

  const operations: Array<{ op: 'add'; path: string; value: any }> = [];
  if (hasCategories) {
    // The PR's healthcareService[] mixes two roles: pointers to service-
    // category HSes (admin-owned, edited via this field) AND pointers to
    // group HSes (group-membership refs, owned by the Group admin). We only
    // replace the service-category subset here — non-category refs (group
    // memberships) survive untouched. Without this, saving a category edit
    // would silently drop the PR from any group it belongs to.
    const incomingIds = new Set(parsed.categoryHealthcareServiceIds ?? []);
    const refIds = (currentRole.healthcareService ?? [])
      .map((ref) => ref.reference?.split('/')[1])
      .filter((id): id is string => !!id);
    const categoryTaggedIds = new Set<string>();
    if (refIds.length > 0) {
      const refBundle = await oystehr.fhir.search<HealthcareService>({
        resourceType: 'HealthcareService',
        params: [{ name: '_id', value: refIds.join(',') }],
      });
      for (const hs of refBundle.unbundle()) {
        const isCategoryTagged = (hs.meta?.tag ?? []).some((t) => t.code === 'booking-service-category');
        if (hs.id && isCategoryTagged) categoryTaggedIds.add(hs.id);
      }
    }
    const preservedNonCategoryRefs = (currentRole.healthcareService ?? []).filter((ref) => {
      const id = ref.reference?.split('/')[1];
      return id && !categoryTaggedIds.has(id);
    });
    const newCategoryRefs = Array.from(incomingIds).map((id) => ({ reference: `HealthcareService/${id}` }));
    operations.push({
      op: 'add',
      path: '/healthcareService',
      value: [...preservedNonCategoryRefs, ...newCategoryRefs],
    });
  }
  if (hasLocation) {
    operations.push({
      op: 'add',
      path: '/location',
      value: [{ reference: `Location/${parsed.locationId}` }],
    });
  }
  if (hasDisplayName) {
    // Replace the display-name extension wholesale: drop any existing one and
    // (if the value is non-empty) add a fresh entry. Empty string → just drop,
    // so callers fall back to the auto-derived "<Provider> @ <Location>" form.
    const trimmed = (parsed.displayName ?? '').trim();
    const otherExtensions = (currentRole.extension ?? []).filter(
      (ext) => ext.url !== SCHEDULE_DISPLAY_NAME_EXTENSION_URL
    );
    const newExtension = trimmed
      ? [...otherExtensions, { url: SCHEDULE_DISPLAY_NAME_EXTENSION_URL, valueString: trimmed }]
      : otherExtensions;
    operations.push({
      op: 'add',
      path: '/extension',
      value: newExtension,
    });
  }

  const updated = await oystehr.fhir.patch<PractitionerRole>({
    resourceType: 'PractitionerRole',
    id: parsed.roleId,
    operations,
  });

  return { statusCode: 200, body: JSON.stringify({ role: updated }) };
});
