import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { AddressBookContactOutput } from 'utils/lib/types/data/address-book';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { topLevelCatch } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { buildAddressBookOrganization, mapAddressBookContact } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'create-address-book-contact',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { contact, secrets } = validateRequestParameters(input);

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createClinicalOystehrClient(m2mToken, secrets);

      const organization = await oystehr.fhir.create<Organization>(buildAddressBookOrganization(contact));
      const output: AddressBookContactOutput = { contact: mapAddressBookContact(organization) };

      return {
        statusCode: 200,
        body: JSON.stringify(output),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('create-address-book-contact', error, ENVIRONMENT);
    }
  }
);
