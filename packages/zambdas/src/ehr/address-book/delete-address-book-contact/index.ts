import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { topLevelCatch } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { isAddressBookOrganization } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'delete-address-book-contact',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { contactId, secrets } = validateRequestParameters(input);

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createClinicalOystehrClient(m2mToken, secrets);

      const existing = await oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: contactId });
      if (!isAddressBookOrganization(existing)) {
        throw INVALID_INPUT_ERROR(`Organization ${contactId} is not an address book contact`);
      }

      await oystehr.fhir.delete({ resourceType: 'Organization', id: contactId });

      return {
        statusCode: 200,
        body: JSON.stringify({}),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('delete-address-book-contact', error, ENVIRONMENT);
    }
  }
);
