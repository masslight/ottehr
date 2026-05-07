import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import { getNPI, getSecret, getTaxID, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAM, getPayerId } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-organizations';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createBillingClient(m2mToken, input.secrets);

    let searchName: string | undefined;
    let type: string | undefined;
    if (input.body) {
      const body = JSON.parse(input.body);
      searchName = body.name;
      type = body.type;
    }

    const params: { name: string; value: string }[] = [
      { name: '_count', value: '50' },
      { name: '_sort', value: 'name' },
      EXCLUDE_WORKING_COPIES_PARAM,
    ];
    if (searchName) {
      params.push({ name: 'name', value: searchName });
    }
    if (type) {
      params.push({ name: 'type', value: type });
    }

    const response = await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params,
    });

    const organizations = response.unbundle().map((o) => {
      const isPayer = o.type?.some((t) => t.coding?.some((c) => c.code === 'pay'));
      return {
        id: o.id,
        name: o.name ?? '',
        npi: getNPI(o) ?? '',
        tin: getTaxID(o) ?? '',
        payerId: getPayerId(o),
        isPayer,
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ organizations }),
    };
  } catch (error: any) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});
