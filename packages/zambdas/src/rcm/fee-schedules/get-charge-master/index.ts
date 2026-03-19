import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { CHARGE_MASTER_DESIGNATION_EXTENSION_URL, getSecret, PRIVATE_EXTENSION_BASE_URL, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('get-charge-master', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { designation, payerOrganizationId, secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const results = await oystehr.fhir.search<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      params: [
        {
          name: '_tag',
          value: `${PRIVATE_EXTENSION_BASE_URL}/rcm|rcm`,
        },
      ],
    });

    const feeSchedules = results.unbundle();

    // If a payer Organization ID is provided, first look for a fee schedule associated with that payer
    if (payerOrganizationId) {
      const payerFeeSchedule = feeSchedules.find(
        (fs) => fs.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${payerOrganizationId}`)
      );

      if (payerFeeSchedule) {
        return {
          statusCode: 200,
          body: JSON.stringify({ feeSchedule: payerFeeSchedule, source: 'payer' }),
        };
      }
    }

    // Fall back to designation-based charge master
    const chargeMaster = feeSchedules.find(
      (fs) =>
        fs.extension?.some(
          (ext) => ext.url === CHARGE_MASTER_DESIGNATION_EXTENSION_URL && ext.valueCode === designation
        )
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ feeSchedule: chargeMaster ?? null, source: chargeMaster ? 'chargemaster' : null }),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('get-charge-master', error, ENVIRONMENT);
  }
});
