import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { ListActiveLocationsOutput } from 'utils/lib/types/api/locations';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';

const ZAMBDA_NAME = 'list-active-locations';

let m2mToken: string;

/**
 * Every active Location as `{ id, name }` — enough to populate a picker, and nothing more.
 *
 * Paginated, so a capped page can't silently truncate a picker into looking like the project has fewer
 * locations than it does.
 *
 * Takes no parameters and is not scoped to the caller: the active-location list is not sensitive, it's
 * reference data every staff member's UI needs. Registered `http_auth`, so the platform still requires a
 * signed-in caller — same posture as the sibling `get-location`.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const locations = await getAllFhirSearchPages<Location>(
    {
      resourceType: 'Location',
      params: [
        { name: 'status', value: 'active' },
        // Only the two fields the output projects. Pages run 1000 at a time, and a full Location
        // carries addresses, telecoms, hours-of-operation, and extensions this endpoint discards.
        { name: '_elements', value: 'id,name' },
      ],
    },
    oystehr
  );

  const output: ListActiveLocationsOutput = {
    locations: locations
      .filter((location): location is Location & { id: string } => !!location.id)
      .map((location) => ({ id: location.id, name: location.name ?? location.id })),
  };

  return { statusCode: 200, body: JSON.stringify(output) };
});
