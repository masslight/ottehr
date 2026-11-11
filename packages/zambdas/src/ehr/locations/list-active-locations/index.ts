import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { isLocationInPerson } from 'utils/lib/fhir/location';
import { ListActiveLocationsInput, ListActiveLocationsOutput } from 'utils/lib/types/api/locations';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const ZAMBDA_NAME = 'list-active-locations';

// The body is optional: most callers send none and get every active Location.
const ListActiveLocationsInputSchema = z.object({ inPersonOnly: z.boolean().optional() });

let m2mToken: string;

/**
 * Every active Location as `{ id, name }` — enough to populate a picker, and nothing more.
 *
 * Paginated, so a capped page can't silently truncate a picker into looking like the project has fewer
 * locations than it does.
 *
 * Takes an optional `inPersonOnly` and is not scoped to the caller: the active-location list is not
 * sensitive, it's reference data every staff member's UI needs. Registered `http_auth`, so the platform
 * still requires a signed-in caller — same posture as the sibling `get-location`.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  const params: ListActiveLocationsInput = safeValidate(
    ListActiveLocationsInputSchema,
    input.body ? safeJsonParse(input.body) : {}
  );

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const output = await performEffect(oystehr, params);

  return { statusCode: 200, body: JSON.stringify(output) };
});

export const performEffect = async (
  oystehr: Oystehr,
  { inPersonOnly }: ListActiveLocationsInput
): Promise<ListActiveLocationsOutput> => {
  const locations = await getAllFhirSearchPages<Location>(
    {
      resourceType: 'Location',
      params: [
        { name: 'status', value: 'active' },
        // Only the fields the output projects (plus the location-form extension when filtering on it).
        // Pages run 1000 at a time, and a full Location carries addresses, telecoms, hours-of-operation,
        // and extensions this endpoint discards.
        { name: '_elements', value: inPersonOnly ? 'id,name,extension' : 'id,name' },
      ],
    },
    oystehr
  );

  return {
    locations: locations
      .filter((location): location is Location & { id: string } => !!location.id)
      .filter((location) => !inPersonOnly || isLocationInPerson(location))
      .map((location) => ({ id: location.id, name: location.name ?? location.id })),
  };
};
