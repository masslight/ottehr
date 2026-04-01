import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { createCandidClientIfConfigured, syncCreateCandidEmployerPayer } from '../candid-sync';
import {
  buildEmployerType,
  normalizeAddress,
  normalizeEmployerNotesExtension,
  normalizeIdentifier,
  normalizeTelecom,
  setOrUpdateCandidIdentifier,
} from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('create-employer', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { name, active, category, identifier, address, contact, secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const categoryText = category || 'Occupational Medicine';

    // Step 1: Create the FHIR Organization
    let organization = await oystehr.fhir.create<Organization>({
      resourceType: 'Organization',
      active: active ?? true,
      name,
      type: buildEmployerType(categoryText),
      identifier: normalizeIdentifier(identifier),
      address: normalizeAddress(address),
      telecom: normalizeTelecom(contact),
      extension: normalizeEmployerNotesExtension(contact?.notes),
    });

    // Step 2: Sync to Candid (best-effort — errors are logged, not re-thrown)
    const candid = createCandidClientIfConfigured(secrets);
    if (candid) {
      const candidPayerId = await syncCreateCandidEmployerPayer(candid, name, categoryText, organization.address);
      if (candidPayerId) {
        // Step 3: Persist the Candid payer ID back into the Organization identifier
        organization = await oystehr.fhir.update<Organization>({
          ...organization,
          identifier: setOrUpdateCandidIdentifier(organization, candidPayerId),
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(organization),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('create-employer', error, ENVIRONMENT);
  }
});
