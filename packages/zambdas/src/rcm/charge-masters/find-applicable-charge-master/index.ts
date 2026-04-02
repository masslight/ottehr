import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import { createOystehrClient, RCM_TAG_SYSTEM, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

/**
 * Given a date of service and an optional payer, finds the most applicable charge master.
 *
 * Resolution order:
 *   1. Payer-specific charge master (matched via useContext) whose effective date (ChargeItemDefinition.date)
 *      is on or before the date of service, selecting the one with the most recent effective date.
 *   2. Default-insurance designated charge master whose effective date is on or before the date of service,
 *      selecting the one with the most recent effective date.
 *   3. If no payer was provided, look for a self-pay designated charge master instead.
 *
 * Response includes a `source` field: 'payer-specific' | 'default-insurance' | 'self-pay' | null.
 */

function findMostRecentEffective(
  chargeMasters: ChargeItemDefinition[],
  dateOfService: string
): ChargeItemDefinition | undefined {
  return chargeMasters
    .filter((cm) => cm.status === 'active' && cm.date && cm.date <= dateOfService)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
}

export const index = wrapHandler(
  'find-applicable-charge-master',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { payerOrganizationId, dateOfService, secrets } = validateRequestParameters(input);
      const oystehr = createOystehrClient(input.accessToken!, secrets);

      // Fetch all active charge masters tagged as charge-master
      const allResults = await oystehr.fhir.search<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        params: [
          { name: '_tag', value: `${RCM_TAG_SYSTEM}|charge-master` },
          { name: 'status', value: 'active' },
        ],
      });

      const allChargeMasters = allResults.unbundle();

      // 1. Try payer-specific charge master
      if (payerOrganizationId) {
        const payerSpecific = allChargeMasters.filter(
          (cm) => cm.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${payerOrganizationId}`)
        );

        const match = findMostRecentEffective(payerSpecific, dateOfService);
        if (match) {
          return {
            statusCode: 200,
            body: JSON.stringify({ chargeMaster: match, source: 'payer-specific' }),
          };
        }
      }

      // 2. Try default-insurance designated charge masters
      if (payerOrganizationId) {
        const defaultInsurance = allChargeMasters.filter(
          (cm) => cm.meta?.tag?.some((t) => t.system === RCM_TAG_SYSTEM && t.code === 'default-insurance')
        );

        const match = findMostRecentEffective(defaultInsurance, dateOfService);
        if (match) {
          return {
            statusCode: 200,
            body: JSON.stringify({ chargeMaster: match, source: 'default-insurance' }),
          };
        }
      }

      // 3. Self-pay fallback (when no payer provided)
      if (!payerOrganizationId) {
        const selfPay = allChargeMasters.filter(
          (cm) => cm.meta?.tag?.some((t) => t.system === RCM_TAG_SYSTEM && t.code === 'self-pay')
        );

        const match = findMostRecentEffective(selfPay, dateOfService);
        if (match) {
          return {
            statusCode: 200,
            body: JSON.stringify({ chargeMaster: match, source: 'self-pay' }),
          };
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ chargeMaster: null, source: null }),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('find-applicable-charge-master', error, ENVIRONMENT);
    }
  }
);
