import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService, PractitionerRole } from 'fhir/r4b';
import {
  INVALID_INPUT_ERROR,
  isServiceCategoryHealthcareService,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL,
  SCHEDULE_DISPLAY_NAME_EXTENSION_URL,
  Secrets,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { checkPractitionerRoleConflict } from '../admin-practitioner-role-shared/check-conflict';

interface AdminUpdatePractitionerRoleInput {
  secrets: Secrets | null;
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
  /**
   * Whether the role offers every service category in the system. Stored as
   * a boolean PR extension. Omit the field to leave the existing value
   * untouched; pass `false` to explicitly clear.
   */
  allCategories?: boolean;
}

const ZAMBDA_NAME = 'admin-update-practitioner-role';
let m2mToken: string;

const validateRequestParameters = (input: ZambdaInput): AdminUpdatePractitionerRoleInput => {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let parsed: {
    roleId?: unknown;
    categoryHealthcareServiceIds?: unknown;
    locationId?: unknown;
    displayName?: unknown;
    allCategories?: unknown;
  };
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body must be valid JSON');
  }
  const { roleId, categoryHealthcareServiceIds, locationId, displayName, allCategories } = parsed;

  if (!roleId) throw MISSING_REQUIRED_PARAMETERS(['roleId']);
  if (typeof roleId !== 'string') throw INVALID_INPUT_ERROR('"roleId" must be a string');

  if (categoryHealthcareServiceIds !== undefined) {
    if (!Array.isArray(categoryHealthcareServiceIds))
      throw INVALID_INPUT_ERROR('"categoryHealthcareServiceIds" must be an array if provided');
    if (!categoryHealthcareServiceIds.every((id) => typeof id === 'string'))
      throw INVALID_INPUT_ERROR('"categoryHealthcareServiceIds" must contain only strings');
  }
  if (locationId !== undefined && typeof locationId !== 'string')
    throw INVALID_INPUT_ERROR('"locationId" must be a string if provided');
  if (displayName !== undefined && typeof displayName !== 'string')
    throw INVALID_INPUT_ERROR('"displayName" must be a string if provided');
  if (allCategories !== undefined && typeof allCategories !== 'boolean')
    throw INVALID_INPUT_ERROR('"allCategories" must be a boolean if provided');

  const hasCategories = Array.isArray(categoryHealthcareServiceIds);
  const hasLocation = typeof locationId === 'string' && locationId.length > 0;
  const hasDisplayName = typeof displayName === 'string';
  const hasAllCategories = typeof allCategories === 'boolean';
  if (!hasCategories && !hasLocation && !hasDisplayName && !hasAllCategories) {
    throw INVALID_INPUT_ERROR(
      'At least one of "categoryHealthcareServiceIds", "locationId", "displayName", or "allCategories" must be provided'
    );
  }

  return { secrets: input.secrets, roleId, categoryHealthcareServiceIds, locationId, displayName, allCategories };
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parsed = validateRequestParameters(input);
  const hasCategories = Array.isArray(parsed.categoryHealthcareServiceIds);
  const hasLocation = typeof parsed.locationId === 'string' && parsed.locationId.length > 0;
  const hasDisplayName = typeof parsed.displayName === 'string';
  const hasAllCategories = typeof parsed.allCategories === 'boolean';

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parsed.secrets);
  const oystehr = createOystehrClient(m2mToken, parsed.secrets);

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
  // Compute the post-update allCategories value: caller-provided wins; if not
  // provided, fall back to the role's existing value. Needed so the conflict
  // check sees the post-update offering, not the pre-update one.
  const currentAllCategories = (currentRole.extension ?? []).some(
    (ext) => ext.url === PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL && ext.valueBoolean === true
  );
  const targetAllCategories = hasAllCategories ? parsed.allCategories === true : currentAllCategories;

  // Run the conflict check whenever the post-update role offers anything —
  // either via specific category refs or via the all-categories toggle. The
  // helper has its own early-out for the "offers nothing" case, but we still
  // need the outer guard for the practitioner-ref/location-ref preconditions.
  if (practitionerRef && targetLocationRef && (targetCategoryIds.length > 0 || targetAllCategories)) {
    const categoryNameById = new Map<string, string>();
    if (targetCategoryIds.length > 0) {
      const hsBundle = await oystehr.fhir.search<HealthcareService>({
        resourceType: 'HealthcareService',
        params: [{ name: '_id', value: targetCategoryIds.join(',') }],
      });
      for (const hs of hsBundle.unbundle()) {
        if (hs.id) categoryNameById.set(hs.id, hs.name ?? hs.id);
      }
    }
    const conflict = await checkPractitionerRoleConflict(
      oystehr,
      {
        id: parsed.roleId,
        practitionerRef,
        locationRef: targetLocationRef,
        categoryHsIds: targetCategoryIds,
        allCategories: targetAllCategories,
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
        // Match both system and code via the canonical predicate — a bare
        // `code === 'booking-service-category'` check would misidentify any
        // resource carrying a colliding code from a different system.
        if (hs.id && isServiceCategoryHealthcareService(hs)) categoryTaggedIds.add(hs.id);
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
  if (hasDisplayName || hasAllCategories) {
    // Both display-name and all-categories live on the role's extension[]
    // array, so the patch is a single wholesale replace combining all the
    // managed extensions plus any preserved foreign ones. For each managed
    // extension:
    //   - field omitted from the payload → preserve the existing extension
    //     (no touch — the caller wasn't editing this field)
    //   - field provided with the absence-sentinel value (empty string for
    //     display name; explicit false for all-categories) → drop the
    //     extension (caller is explicitly clearing it)
    //   - field provided with a meaningful value → write the extension
    const managedUrls = new Set<string>([
      SCHEDULE_DISPLAY_NAME_EXTENSION_URL,
      PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL,
    ]);
    const preservedExtensions = (currentRole.extension ?? []).filter((ext) => !managedUrls.has(ext.url ?? ''));

    // Display name: caller omitted → preserve existing; passed string → write
    // (empty trims to "drop"); other types blocked by validator.
    let displayNameExt: { url: string; valueString: string } | undefined;
    if (hasDisplayName) {
      const trimmed = (parsed.displayName ?? '').trim();
      if (trimmed) displayNameExt = { url: SCHEDULE_DISPLAY_NAME_EXTENSION_URL, valueString: trimmed };
    } else {
      const existing = (currentRole.extension ?? []).find((ext) => ext.url === SCHEDULE_DISPLAY_NAME_EXTENSION_URL);
      if (existing?.valueString)
        displayNameExt = { url: SCHEDULE_DISPLAY_NAME_EXTENSION_URL, valueString: existing.valueString };
    }

    // all-categories: only written when the toggle is explicitly true; false
    // (or omitted-with-no-existing) → no extension persisted, since absence
    // already reads as false per getPractitionerRoleAllCategories.
    let allCategoriesExt: { url: string; valueBoolean: true } | undefined;
    if (hasAllCategories) {
      if (parsed.allCategories === true)
        allCategoriesExt = { url: PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL, valueBoolean: true };
    } else {
      const existing = (currentRole.extension ?? []).find(
        (ext) => ext.url === PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL
      );
      if (existing?.valueBoolean === true)
        allCategoriesExt = { url: PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL, valueBoolean: true };
    }

    const newExtension = [
      ...preservedExtensions,
      ...(displayNameExt ? [displayNameExt] : []),
      ...(allCategoriesExt ? [allCategoriesExt] : []),
    ];
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
