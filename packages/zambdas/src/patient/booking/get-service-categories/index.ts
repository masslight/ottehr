import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { SERVICE_CATEGORY_TAG, SLUG_SYSTEM } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { buildCatalog, filterByOfferedCodes, getGroupOfferedCodes } from './helpers';

let m2mToken: string;

export const index = wrapHandler(
  'get-service-categories',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.secrets) throw new Error('No secrets provided');
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
