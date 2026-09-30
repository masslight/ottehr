import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  ADDRESS_BOOK_TAG_CODE,
  ADDRESS_BOOK_TAG_SYSTEM,
  ADDRESS_BOOK_USER_TAG_SYSTEM,
  SearchAddressBookOutput,
} from 'utils/lib/types/data/address-book';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { fetchAllPages } from '../../../shared/fhir';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { topLevelCatch } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { mapAddressBookContact } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('search-address-book', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { tag, secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const organizations: Organization[] = [];
    await fetchAllPages(async (offset, count) => {
      const bundle = await oystehr.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [
          { name: '_tag', value: `${ADDRESS_BOOK_TAG_SYSTEM}|${ADDRESS_BOOK_TAG_CODE}` },
          ...(tag ? [{ name: '_tag', value: `${ADDRESS_BOOK_USER_TAG_SYSTEM}|${tag}` }] : []),
          { name: '_count', value: count.toString() },
          { name: '_offset', value: offset.toString() },
        ],
      });
      organizations.push(...bundle.unbundle());
      return bundle;
    }, 1000);

    const output: SearchAddressBookOutput = {
      contacts: organizations
        .map(mapAddressBookContact)
        .sort((a, b) => (a.organizationName ?? a.lastName ?? '').localeCompare(b.organizationName ?? b.lastName ?? '')),
    };

    return {
      statusCode: 200,
      body: JSON.stringify(output),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('search-address-book', error, ENVIRONMENT);
  }
});
