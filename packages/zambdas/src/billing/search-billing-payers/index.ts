import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import { getPayerId } from 'utils/lib/helpers/helpers';
import { BillingPayerOption } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient } from '../shared';
import { SearchBillingPayersParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-payers';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingPayersParams
): Promise<{ payers: BillingPayerOption[]; nextCursor?: string | null }> {
  // Payers live in the Oystehr RCM service
  if (params.payerId) {
    const result = await oystehr.rcm.getPayer({ id: params.payerId });
    if (result) {
      return { payers: [mapPayer(result)] };
    }
  }
  // No name given: this is a plain directory listing (e.g. the Insurance Organizations page), so
  // page straight through the RCM service's own cursor instead of the typeahead's name+id merge below.
  if (!params.name) {
    const result = await oystehr.rcm.listPayers({
      ...(params.cursor ? { cursor: params.cursor } : {}),
      limit: params.limit ?? 50,
      sort: 'name',
      sortOrder: 'asc',
    });
    return { payers: result.data.map(mapPayer), nextCursor: result.metadata.nextCursor };
  }
  const resultByName = await oystehr.rcm.listPayers({ name: params.name, limit: 50 });
  const resultById = await oystehr.rcm.listPayers({ id: params.name, limit: 50 });
  const payers = [...resultByName.data, ...resultById.data]
    .map((payer) => mapPayer(payer))
    .reduce((map, payer) => map.set(payer.id, payer), new Map<string, BillingPayerOption>())
    .values()
    .toArray();
  return { payers };
}

function mapPayer(payer: Organization): BillingPayerOption {
  return {
    id: payer.id ?? '',
    name: payer.name ?? '',
    payerId: getPayerId(payer) ?? '',
  };
}
