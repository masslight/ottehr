import { APIGatewayProxyResult } from 'aws-lambda';
import { CodeableConcept, HealthcareService } from 'fhir/r4b';
import {
  getGroupAllLocations,
  getGroupAssignmentMode,
  GROUP_OWNED_CHARACTERISTIC_SYSTEMS,
  groupCharacteristics,
  INVALID_INPUT_ERROR,
  isServiceCategoryHealthcareService,
  isValidSlug,
  mergeOwnedCharacteristics,
  MISSING_REQUEST_BODY,
  SCHEDULE_STRATEGY_SYSTEM,
  Secrets,
  SERVICE_CATEGORY_SYSTEM,
  SLUG_SYSTEM,
  SLUG_VALIDATION_MESSAGE,
} from 'utils';
import { z } from 'zod';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  safeJsonParse,
  safeValidate,
  wrapHandler,
  ZambdaInput,
} from '../../shared';

/**
 * Fields that can be updated on a Group HealthcareService. Every field is
 * optional so callers can send just the ones they touched — omitted fields
 * are preserved on the server. This mirrors the behavior of
 * admin-update-practitioner-role and matches what the GroupPage's save
 * button was doing directly against FHIR before this zambda existed.
 */
interface AdminUpdateGroupInput {
  secrets: Secrets | null;
  groupId: string;
  /** New group name. Omit to leave untouched. Empty string is rejected — the
   *  Group's display name is load-bearing in the picker + booking flows. */
  name?: string;
  /** URL slug (Group's SLUG_SYSTEM identifier). Omit to leave untouched.
   *  Empty string clears the slug (the Group becomes unbookable via URL). */
  slug?: string;
  /** Full replacement for the Group's `.location[]`. Omit to leave untouched.
   *  Ignored when `allLocations === true` because the "pool everywhere" path
   *  intentionally clears .location[] regardless of what was configured. */
  locationIds?: string[];
  /** Full replacement for the Group's `.type[]` — the service-category
   *  allow-list. Values are FHIR HealthcareService ids of category records
   *  (SERVICE_CATEGORY_TAG-tagged HSes). The zambda expands each id to its
   *  code + display via a FHIR lookup so the client doesn't have to. */
  supportedCategoryHsIds?: string[];
  /** Group assignment mode ('anonymous' | 'provider'). Omit to leave
   *  untouched. Written to .characteristic[] under GROUP_ASSIGNMENT_MODE_SYSTEM. */
  assignmentMode?: 'anonymous' | 'provider';
  /** All-locations pooling toggle. When true, the group pools from every
   *  active PR system-wide and .location[] is intentionally cleared even if
   *  locationIds was provided. Omit to leave untouched. */
  allLocations?: boolean;
}

const ZAMBDA_NAME = 'admin-update-group';
let m2mToken: string;

// Empty string on slug is intentional (clears the identifier). Non-empty
// slugs must match the URL-safe shape or they'd silently corrupt the
// patient-side booking URL. isValidSlug lives in utils so client + server
// share the exact same rule.
const UpdateGroupSchema = z
  .object({
    groupId: z.string().min(1, '"groupId" is required'),
    name: z.string().trim().min(1, '"name" must not be empty when provided').optional(),
    slug: z
      .string()
      .refine((val) => val.length === 0 || isValidSlug(val), { message: `"slug" ${SLUG_VALIDATION_MESSAGE}` })
      .optional(),
    locationIds: z.array(z.string()).optional(),
    supportedCategoryHsIds: z.array(z.string()).optional(),
    assignmentMode: z.enum(['anonymous', 'provider']).optional(),
    allLocations: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.slug !== undefined ||
      data.locationIds !== undefined ||
      data.supportedCategoryHsIds !== undefined ||
      data.assignmentMode !== undefined ||
      data.allLocations !== undefined,
    {
      message:
        'At least one of "name", "slug", "locationIds", "supportedCategoryHsIds", "assignmentMode", or "allLocations" must be provided',
    }
  );

const validateRequestParameters = (input: ZambdaInput): AdminUpdateGroupInput => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const parsed = safeValidate(UpdateGroupSchema, safeJsonParse(input.body));
  return {
    secrets: input.secrets,
    groupId: parsed.groupId,
    name: parsed.name,
    slug: parsed.slug,
    locationIds: parsed.locationIds,
    supportedCategoryHsIds: parsed.supportedCategoryHsIds,
    assignmentMode: parsed.assignmentMode,
    allLocations: parsed.allLocations,
  };
};

/**
 * Update a Group HealthcareService — the server-side replacement for the
 * ad-hoc `oystehr.fhir.transaction` GroupPage used to issue directly.
 *
 * Behavior is a lift-and-shift of the client-side patch builder:
 *   - `.name`         replace when the caller provided a new value.
 *   - `.identifier[]` rebuilt with the new slug (or with slug identifier
 *                     removed entirely when caller passed empty string).
 *                     Slug format is validated up-front; slug uniqueness is
 *                     checked against other HealthcareServices before writing
 *                     so two Groups can't collide on the same booking URL.
 *   - `.location[]`   replaced with the passed refs, OR intentionally
 *                     cleared when allLocations=true (the "pool everywhere"
 *                     path).
 *   - `.type[]`       rebuilt from the passed HealthcareService ids —
 *                     zambda fetches each category HS to compose the coding
 *                     (code + display).
 *   - `.characteristic[]` merged: groupCharacteristics (assignmentMode +
 *                         allLocations) + the pools-providers strategy
 *                         coding, with any foreign-system characteristics
 *                         preserved unchanged via mergeOwnedCharacteristics.
 *
 * Any of these that aren't supplied by the caller retain their existing
 * value — patient side and Add-Visit flows depend on partial updates
 * behaving as no-ops on unchanged fields.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parsed = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parsed.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, parsed.secrets);

  const currentGroup = await oystehr.fhir.get<HealthcareService>({
    resourceType: 'HealthcareService',
    id: parsed.groupId,
  });

  // Slug uniqueness — a second Group already using this slug would silently
  // start winning URL routing depending on FHIR search order. Check before
  // writing so the caller gets a clear error instead of a corrupted UX.
  if (parsed.slug !== undefined && parsed.slug.length > 0) {
    const clash = await oystehr.fhir.search<HealthcareService>({
      resourceType: 'HealthcareService',
      params: [{ name: 'identifier', value: `${SLUG_SYSTEM}|${parsed.slug}` }],
    });
    const conflicting = clash.unbundle().find((hs) => hs.id && hs.id !== parsed.groupId);
    if (conflicting) {
      throw INVALID_INPUT_ERROR(
        `Slug "${parsed.slug}" is already used by another Group (${conflicting.id}). Slugs must be unique.`
      );
    }
  }

  const operations: Array<{ op: 'add' | 'replace'; path: string; value: unknown }> = [];

  if (parsed.name !== undefined && parsed.name !== (currentGroup.name ?? '')) {
    operations.push({
      op: currentGroup.name === undefined ? 'add' : 'replace',
      path: '/name',
      value: parsed.name,
    });
  }

  if (parsed.slug !== undefined) {
    const currentSlug = currentGroup.identifier?.find((id) => id.system === SLUG_SYSTEM)?.value ?? '';
    if (parsed.slug !== currentSlug) {
      const preservedIdentifiers = currentGroup.identifier?.filter((id) => id.system !== SLUG_SYSTEM) ?? [];
      const newIdentifiers =
        parsed.slug.length > 0
          ? [...preservedIdentifiers, { system: SLUG_SYSTEM, value: parsed.slug }]
          : preservedIdentifiers;
      operations.push({
        op: currentGroup.identifier === undefined ? 'add' : 'replace',
        path: '/identifier',
        value: newIdentifiers,
      });
    }
  }

  // Location handling. allLocations=true forces .location[] to []; otherwise
  // if locationIds was provided we use it verbatim. Nothing supplied for
  // either → preserve existing location[].
  if (parsed.allLocations === true) {
    operations.push({
      op: currentGroup.location ? 'replace' : 'add',
      path: '/location',
      value: [],
    });
  } else if (parsed.locationIds !== undefined) {
    operations.push({
      op: currentGroup.location ? 'replace' : 'add',
      path: '/location',
      value: parsed.locationIds.map((id) => ({ reference: `Location/${id}` })),
    });
  }

  // Rebuild .type[] from the caller's category HS ids. Doing the lookup
  // server-side is the whole point of moving this off the client — the
  // client used to hold a `categoryByHsId` map from its data load, which
  // was authoritative only within one page session and hard to keep in
  // sync with FHIR concurrently. Here we fetch fresh + verify each id is
  // actually a service-category HS (via `isServiceCategoryHealthcareService`)
  // so a caller can't smuggle in an arbitrary HS id and pollute the
  // Group's category allow-list.
  if (parsed.supportedCategoryHsIds !== undefined) {
    const newType: CodeableConcept[] = [];
    if (parsed.supportedCategoryHsIds.length > 0) {
      const hsBundle = await oystehr.fhir.search<HealthcareService>({
        resourceType: 'HealthcareService',
        params: [{ name: '_id', value: parsed.supportedCategoryHsIds.join(',') }],
      });
      const hsById = new Map<string, HealthcareService>();
      for (const hs of hsBundle.unbundle()) {
        if (hs.id) hsById.set(hs.id, hs);
      }
      for (const id of parsed.supportedCategoryHsIds) {
        const hs = hsById.get(id);
        if (!hs) {
          throw INVALID_INPUT_ERROR(`Category HealthcareService "${id}" not found in FHIR.`);
        }
        if (!isServiceCategoryHealthcareService(hs)) {
          throw INVALID_INPUT_ERROR(
            `HealthcareService "${id}" is not tagged as a service category — refusing to add to Group.type[].`
          );
        }
        // Prefer type[0].coding[0] (which is where admin-{create,update}-service-category
        // writes the canonical code). Fall back to a minimal { code } derived
        // from the HS name/id so the shape is still valid.
        const canonical = hs.type?.[0]?.coding?.find((c) => c.system === SERVICE_CATEGORY_SYSTEM);
        const code = canonical?.code ?? id;
        const display = canonical?.display ?? hs.name ?? code;
        newType.push({
          coding: [{ system: SERVICE_CATEGORY_SYSTEM, code, display }],
          text: display,
        });
      }
    }
    operations.push({
      op: currentGroup.type ? 'replace' : 'add',
      path: '/type',
      value: newType,
    });
  }

  // Characteristic handling. We only touch characteristics when the caller
  // touched something that lives in them — either the assignmentMode
  // toggle, the allLocations toggle, or (implicitly) the strategy which we
  // always want to keep set to `pools-providers` for post-refactor Groups.
  //
  // Non-group-owned characteristic codings (foreign systems) survive
  // untouched via mergeOwnedCharacteristics — the pre-existing
  // characteristic array might hold coverage-area codings, service-mode
  // markers, etc. that other code owns.
  const touchingCharacteristics = parsed.assignmentMode !== undefined || parsed.allLocations !== undefined;
  if (touchingCharacteristics) {
    // Compute the effective assignmentMode + allLocations values. Caller
    // provides one xor both; the OTHER is read off the existing resource
    // via the shared getGroup* helpers so groupCharacteristics gets a
    // consistent pair AND the read stays coupled to the canonical
    // GROUP_ASSIGNMENT_MODE_SYSTEM / GROUP_ALL_LOCATIONS_SYSTEM constants
    // (no hand-rolled suffix matching that could false-positive on a
    // foreign system that happens to share the trailing path segment).
    const effectiveAssignmentMode: 'anonymous' | 'provider' =
      parsed.assignmentMode ?? getGroupAssignmentMode(currentGroup) ?? 'anonymous';
    const effectiveAllLocations: boolean = parsed.allLocations ?? getGroupAllLocations(currentGroup) === true;

    const ownedSystems = [...GROUP_OWNED_CHARACTERISTIC_SYSTEMS, SCHEDULE_STRATEGY_SYSTEM];
    const newCharacteristics = mergeOwnedCharacteristics(currentGroup.characteristic, ownedSystems, [
      ...groupCharacteristics({
        assignmentMode: effectiveAssignmentMode,
        allLocations: effectiveAllLocations,
      }),
      {
        coding: [{ system: SCHEDULE_STRATEGY_SYSTEM, code: 'pools-providers', display: 'Pools Providers' }],
      },
    ]);
    operations.push({
      op: currentGroup.characteristic ? 'replace' : 'add',
      path: '/characteristic',
      value: newCharacteristics,
    });
  }

  // Caller supplied fields but none of them differed from the current
  // record (e.g., re-save of an unchanged form). Nothing to patch, but a
  // no-op success matches the previous client behavior.
  if (operations.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ group: currentGroup }) };
  }

  const updated = await oystehr.fhir.patch<HealthcareService>({
    resourceType: 'HealthcareService',
    id: parsed.groupId,
    operations,
  });

  return { statusCode: 200, body: JSON.stringify({ group: updated }) };
});
