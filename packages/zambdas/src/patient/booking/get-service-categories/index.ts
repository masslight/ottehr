import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService, PractitionerRole } from 'fhir/r4b';
import {
  FEATURE_FLAGS_CONFIG,
  getPractitionerRoleAllCategories,
  INVALID_INPUT_ERROR,
  Secrets,
  SERVICE_CATEGORIES_AVAILABLE,
  SERVICE_CATEGORY_TAG,
  SLUG_SYSTEM,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { buildCatalog, buildFhirCatalog, filterByOfferedCodes, getGroupOfferedCodes } from './helpers';

interface GetServiceCategoriesInput {
  secrets: Secrets | null;
  /**
   * Optional scoping context. Two shapes are honored today:
   *  - scheduleType==='group' && bookingOn=<slug> → intersect the catalog
   *    with the group's declared type[] codes.
   *  - scheduleType==='provider' && bookingOn=<slug> → intersect the FHIR
   *    catalog with the PR's healthcareService[] refs, or return the full
   *    FHIR catalog when the PR has the all-categories toggle set.
   * Any other combination returns the full catalog.
   */
  scheduleType?: string;
  bookingOn?: string;
}

let m2mToken: string;

const validateRequestParameters = (input: ZambdaInput): GetServiceCategoriesInput => {
  // Body is optional — when omitted (or unparseable), we return the full
  // catalog. When present, scheduleType + bookingOn must be strings if set.
  let scheduleType: string | undefined;
  let bookingOn: string | undefined;
  if (input.body) {
    let parsed: { scheduleType?: unknown; bookingOn?: unknown };
    try {
      parsed = JSON.parse(input.body);
    } catch {
      throw INVALID_INPUT_ERROR('Request body must be valid JSON if provided');
    }
    if (parsed.scheduleType !== undefined) {
      if (typeof parsed.scheduleType !== 'string')
        throw INVALID_INPUT_ERROR('"scheduleType" must be a string if provided');
      scheduleType = parsed.scheduleType;
    }
    if (parsed.bookingOn !== undefined) {
      if (typeof parsed.bookingOn !== 'string') throw INVALID_INPUT_ERROR('"bookingOn" must be a string if provided');
      // bookingOn is interpolated raw into a FHIR `identifier` search as
      // `${SLUG_SYSTEM}|${bookingOn}`. Without a format guard, a `|` in the
      // value would break out of the value side and inject extra clauses.
      if (!/^[a-zA-Z0-9-]+$/.test(parsed.bookingOn))
        throw INVALID_INPUT_ERROR('"bookingOn" must be a URL-safe slug (letters, digits, hyphens)');
      bookingOn = parsed.bookingOn;
    }
  }
  return { secrets: input.secrets, scheduleType, bookingOn };
};

export const index = wrapHandler(
  'get-service-categories',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets, scheduleType, bookingOn } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    // Feature flag: when off (default), patient-facing booking sees only
    // BOOKING_CONFIG categories. Admin-registered FHIR HealthcareService
    // categories are suppressed so a customer experimenting with adding one
    // doesn't accidentally expose it to patients. Admin UI uses a separate
    // zambda (admin-list-service-categories) and is unaffected. Skipping
    // the FHIR search when off also saves a roundtrip per call.
    //
    // The flag gates the general/location/group catalog. The provider case
    // ignores it and always fetches FHIR resources: a provider deeplink is
    // by construction bookable only against the categories the PR is
    // credentialed for, and PR credentialing lives in FHIR (there's no
    // BOOKING_CONFIG code a PR can legitimately opt into — get-schedule
    // hard-excludes PR-owned schedules from BOOKING_CONFIG categories).
    // Honoring the flag here would return an empty picker in the common
    // "flag off but the site uses provider deeplinks" configuration.
    const fhirResources =
      FEATURE_FLAGS_CONFIG.dynamicServiceCategoriesEnabled || scheduleType === 'provider'
        ? (
            await oystehr.fhir.search<HealthcareService>({
              resourceType: 'HealthcareService',
              params: [
                { name: '_tag', value: SERVICE_CATEGORY_TAG.code },
                { name: 'active', value: 'true' },
              ],
            })
          ).unbundle()
        : [];
    const fullCatalog = buildCatalog(fhirResources);

    if (scheduleType === 'provider' && bookingOn) {
      const prMatches = (
        await oystehr.fhir.search<PractitionerRole>({
          resourceType: 'PractitionerRole',
          params: [
            { name: 'identifier', value: `${SLUG_SYSTEM}|${bookingOn}` },
            // Match get-schedule's filter: a soft-deleted PR shouldn't leak
            // categories into the picker. `active !== false` per FHIR
            // convention; the negated search param covers absent-and-true.
            { name: 'active:not', value: 'false' },
          ],
        })
      ).unbundle();
      const pr = prMatches[0];
      if (!pr) {
        // Provider slug resolved to nothing. Mirror the group not-found path
        // — empty catalog rather than falling back to the full system catalog,
        // which would silently mask a misrouted link with an otherwise-normal
        // picker of categories the provider can't actually serve.
        return {
          statusCode: 200,
          body: JSON.stringify({ serviceCategories: [] }),
        };
      }

      // The provider-scoped response only surfaces FHIR-backed categories.
      // BOOKING_CONFIG entries are never valid on a PR-owned schedule
      // (get-schedule/index.ts:184-187 hard-excludes them), so leaving them
      // in the picker would let a patient pick a category that immediately
      // returns "no slots" once get-schedule filters the PR out. A FHIR
      // HealthcareService whose code happens to collide with a BOOKING_CONFIG
      // code is dropped for the same reason — buildCatalog already treats
      // BOOKING_CONFIG as the precedence winner on code collision, so the
      // patient's system-level picker wouldn't surface the FHIR entry either.
      const bookingConfigCodes = new Set(
        SERVICE_CATEGORIES_AVAILABLE.map((sc) => sc.category.code).filter((c): c is string => Boolean(c))
      );
      const stripBookingCollisions = (records: ReturnType<typeof buildFhirCatalog>): typeof records =>
        records.filter((r) => !bookingConfigCodes.has(r.code));

      if (getPractitionerRoleAllCategories(pr)) {
        return {
          statusCode: 200,
          body: JSON.stringify({ serviceCategories: stripBookingCollisions(buildFhirCatalog(fhirResources)) }),
        };
      }

      // Intersect the PR's healthcareService[] refs with the category-tagged
      // FHIR catalog by resource id. Refs that don't resolve to a category
      // HealthcareService (the field can also hold group-membership refs to
      // HealthcareServices that aren't category-tagged) drop out naturally
      // because they aren't in fhirResources.
      const referencedIds = new Set(
        (pr.healthcareService ?? []).map((r) => r.reference?.split('/')[1]).filter((id): id is string => Boolean(id))
      );
      const providerCatalog = stripBookingCollisions(
        buildFhirCatalog(fhirResources).filter((sc) => sc.id !== undefined && referencedIds.has(sc.id))
      );
      return {
        statusCode: 200,
        body: JSON.stringify({ serviceCategories: providerCatalog }),
      };
    }

    if (scheduleType === 'group' && bookingOn) {
      const groupMatches = (
        await oystehr.fhir.search<HealthcareService>({
          resourceType: 'HealthcareService',
          params: [{ name: 'identifier', value: `${SLUG_SYSTEM}|${bookingOn}` }],
        })
      ).unbundle();
      const group = groupMatches[0];
      if (!group) {
        // A group was clearly requested but the slug resolved to nothing.
        // Return an empty catalog rather than fall back to the full system
        // catalog — leaking urgent-care / workers-comp etc. into a misrouted
        // group picker would be the wrong default.
        return {
          statusCode: 200,
          body: JSON.stringify({ serviceCategories: [] }),
        };
      }
      const offeredCodes = getGroupOfferedCodes(group);
      return {
        statusCode: 200,
        body: JSON.stringify({ serviceCategories: filterByOfferedCodes(fullCatalog, offeredCodes) }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ serviceCategories: fullCatalog }),
    };
  }
);
