import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { MISSING_REQUEST_SECRETS, SERVICE_CATEGORIES_AVAILABLE, SLUG_SYSTEM } from 'utils';
import {
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  ServiceCategoryRecord,
  toRecord,
} from '../../../ehr/admin-service-categories/helpers';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';

let m2mToken: string;

export const index = wrapHandler(
  'get-service-categories',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.secrets) throw MISSING_REQUEST_SECRETS;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createOystehrClient(m2mToken, input.secrets);

    // Optional: scope the returned categories to those offered by a specific
    // bookable entity (today: a group HealthcareService's declared types).
    let groupContext: { scheduleType?: string; bookingOn?: string } = {};
    try {
      if (input.body) {
        const parsed = JSON.parse(input.body);
        groupContext = { scheduleType: parsed.scheduleType, bookingOn: parsed.bookingOn };
      }
    } catch {
      // bad body — ignore scoping
    }

    // Prefer the FHIR-managed registry. Fall back to the compiled-in
    // BOOKING_CONFIG.SERVICE_CATEGORIES_AVAILABLE if no service categories have
    // been created in FHIR yet, so existing deployments keep working during
    // migration.
    const fromFhir = (
      await oystehr.fhir.search<HealthcareService>({
        resourceType: 'HealthcareService',
        params: [
          { name: '_tag', value: SERVICE_CATEGORY_TAG.code },
          { name: 'active', value: 'true' },
        ],
      })
    ).unbundle();

    const fhirRecords = fromFhir.map(toRecord);
    const fhirCodes = new Set(fhirRecords.map((r) => r.code));
    const configFallback: ServiceCategoryRecord[] = SERVICE_CATEGORIES_AVAILABLE.filter(
      (sc) => sc.category.code && !fhirCodes.has(sc.category.code)
    ).map((sc) => ({
      name: sc.category.display || sc.category.code || '',
      code: sc.category.code || '',
      active: true,
      config: {
        durationMinutes: 15,
        serviceModes: sc.serviceModes as Array<'in-person' | 'virtual'>,
        visitTypes: sc.visitTypes as Array<'prebook' | 'walk-in'>,
        reasonsForVisit: sc.reasonsForVisit?.default,
      },
    }));

    const fullCatalog = [...fhirRecords, ...configFallback];
    const source = fhirRecords.length === 0 ? 'booking-config' : configFallback.length === 0 ? 'fhir' : 'merged';

    // If a group URL scoped the request, intersect the catalog with the
    // group's offered categories (HealthcareService.type[] with SERVICE_CATEGORY_SYSTEM coding).
    let scopedCategories = fullCatalog;
    if (groupContext.scheduleType === 'group' && groupContext.bookingOn) {
      const groupMatches = (
        await oystehr.fhir.search<HealthcareService>({
          resourceType: 'HealthcareService',
          params: [{ name: 'identifier', value: `${SLUG_SYSTEM}|${groupContext.bookingOn}` }],
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
          body: JSON.stringify({ serviceCategories: [], source }),
        };
      }
      if (group) {
        const offeredCodes = new Set<string>();
        for (const concept of group.type || []) {
          for (const coding of concept.coding || []) {
            if (coding.system === SERVICE_CATEGORY_SYSTEM && coding.code) {
              offeredCodes.add(coding.code);
            }
          }
        }
        // Only scope down when the group actually declares categories — if the
        // group has no declared type[], we leave the full catalog so admins who
        // haven't configured this yet don't get blocked.
        if (offeredCodes.size > 0) {
          scopedCategories = fullCatalog.filter((sc) => offeredCodes.has(sc.code));
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ serviceCategories: scopedCategories, source }),
    };
  }
);
