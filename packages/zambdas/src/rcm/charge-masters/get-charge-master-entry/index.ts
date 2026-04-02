import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import { createOystehrClient, RCM_TAG_SYSTEM, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler(
  'get-charge-master-entry',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { designation, payerOrganizationId, dateOfService, secrets } = validateRequestParameters(input);
      const oystehr = createOystehrClient(input.accessToken!, secrets);

      const cutoffDate = dateOfService ?? new Date().toISOString().split('T')[0];

      // If looking for insurance and a payer org is given, first look for a charge master with that payer
      if (designation === 'default-insurance' && payerOrganizationId) {
        const allChargeMasters = await oystehr.fhir.search<ChargeItemDefinition>({
          resourceType: 'ChargeItemDefinition',
          params: [
            {
              name: '_tag',
              value: `${RCM_TAG_SYSTEM}|charge-master`,
            },
          ],
        });

        const chargeMasters = allChargeMasters.unbundle();

        const payerChargeMaster = chargeMasters
          .filter(
            (cm) =>
              cm.status === 'active' &&
              cm.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${payerOrganizationId}`) &&
              cm.date &&
              cm.date <= cutoffDate
          )
          .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];

        if (payerChargeMaster) {
          return {
            statusCode: 200,
            body: JSON.stringify({ chargeMaster: payerChargeMaster, source: 'payer' }),
          };
        }
      }

      // Fall back to the designated default charge master (by tag)
      const designatedResults = await oystehr.fhir.search<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        params: [
          {
            name: '_tag',
            value: `${RCM_TAG_SYSTEM}|${designation}`,
          },
        ],
      });

      const chargeMaster =
        designatedResults
          .unbundle()
          .filter((cm) => cm.status === 'active' && cm.date && cm.date <= cutoffDate)
          .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0] ?? null;

      return {
        statusCode: 200,
        body: JSON.stringify({
          chargeMaster,
          source: chargeMaster ? 'chargemaster' : null,
        }),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('get-charge-master-entry', error, ENVIRONMENT);
    }
  }
);
