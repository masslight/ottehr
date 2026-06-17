import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { INVALID_INPUT_ERROR, Secrets, SERVICE_CATEGORY_TAG, SLUG_SYSTEM } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  safeJsonParse,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { buildCatalog, filterByOfferedCodes, getGroupOfferedCodes } from './helpers';

interface GetServiceCategoriesInput {
  secrets: Secrets | null;
  /** Optional scoping context: when scheduleType==='group' && bookingOn=<slug>, returned categories are filtered to that group's offering. */
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
      parsed = safeJsonParse(input.body);
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
    const oystehr = createOystehrClient(m2mToken, secrets);

    const fhirResources = (
      await oystehr.fhir.search<HealthcareService>({
        resourceType: 'HealthcareService',
        params: [
          { name: '_tag', value: SERVICE_CATEGORY_TAG.code },
          { name: 'active', value: 'true' },
        ],
      })
    ).unbundle();
    const fullCatalog = buildCatalog(fhirResources);

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
