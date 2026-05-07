import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { getNPI, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAM, formatAddress } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-locations';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createBillingClient(m2mToken, input.secrets);

    let searchName: string | undefined;
    if (input.body) {
      const body = JSON.parse(input.body);
      searchName = body.name;
    }

    const params: { name: string; value: string }[] = [
      { name: '_count', value: '50' },
      { name: '_sort', value: 'name' },
      EXCLUDE_WORKING_COPIES_PARAM,
    ];
    if (searchName) {
      params.push({ name: 'name', value: searchName });
    }

    const response = await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params,
    });

    const locations = response.unbundle().map((l) => ({
      id: l.id,
      name: l.name ?? '',
      npi: getNPI(l) ?? '',
      address: formatAddress(l.address),
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ locations }),
    };
  } catch (error: any) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});
