import { APIGatewayProxyResult } from 'aws-lambda';
import { ServiceRequest } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getReferralStatus, REFERRAL_ORDER_TYPE_TAG_TOKEN } from 'utils/lib/fhir/referral';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  ListReferralsInputSchema,
  ListReferralsOutput,
  REFERRAL_ROLES,
} from 'utils/lib/types/api/referrals/referrals.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { topLevelCatch } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import { buildReferralDTOs } from '../shared';

const ZAMBDA_NAME = 'list-referrals';

let m2mToken: string;
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { patientId, encounterId, secrets } = validateWithSchema(ListReferralsInputSchema, input);
    await requireUserWithRole(getUserToken(input), secrets, REFERRAL_ROLES);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const serviceRequests = await getAllFhirSearchPages<ServiceRequest>(
      {
        resourceType: 'ServiceRequest',
        params: [
          { name: '_tag', value: REFERRAL_ORDER_TYPE_TAG_TOKEN },
          ...(patientId ? [{ name: 'subject', value: `Patient/${patientId}` }] : []),
          ...(encounterId ? [{ name: 'encounter', value: `Encounter/${encounterId}` }] : []),
        ],
      },
      oystehr
    );

    const listed = serviceRequests.filter((serviceRequest) => getReferralStatus(serviceRequest) !== 'cancelled');
    const output: ListReferralsOutput = { referrals: await buildReferralDTOs(oystehr, listed) };
    return { statusCode: 200, body: JSON.stringify(output) };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
