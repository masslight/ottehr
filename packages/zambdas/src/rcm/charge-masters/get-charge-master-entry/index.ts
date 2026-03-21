import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { CHARGE_MASTER_DESIGNATION_EXTENSION_URL, getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  RCM_TAG_SYSTEM,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'get-charge-master-entry',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { designation, payerOrganizationId, secrets } = validateRequestParameters(input);

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

      const results = await oystehr.fhir.search<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        params: [
          {
            name: '_tag',
            value: `${RCM_TAG_SYSTEM}|charge-master`,
          },
        ],
      });

      const chargeMasters = results.unbundle();

      // If a payer Organization ID is provided, first look for a charge master associated with that payer
      if (payerOrganizationId) {
        const payerChargeMaster = chargeMasters.find(
          (cm) => cm.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${payerOrganizationId}`)
        );

        if (payerChargeMaster) {
          return {
            statusCode: 200,
            body: JSON.stringify({ chargeMaster: payerChargeMaster, source: 'payer' }),
          };
        }
      }

      // Fall back to designation-based charge master
      const chargeMaster = chargeMasters.find(
        (cm) =>
          cm.extension?.some(
            (ext) => ext.url === CHARGE_MASTER_DESIGNATION_EXTENSION_URL && ext.valueCode === designation
          )
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          chargeMaster: chargeMaster ?? null,
          source: chargeMaster ? 'chargemaster' : null,
        }),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('get-charge-master-entry', error, ENVIRONMENT);
    }
  }
);
