import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  RCM_TAG_SYSTEM,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'get-charge-master-entry',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { designation, payerOrganizationId, dateOfService, locationId, secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

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

      const payerFiltered = chargeMasters
        .filter(
          (cm) =>
            cm.status === 'active' &&
            cm.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${payerOrganizationId}`) &&
            cm.date &&
            cm.date <= cutoffDate
        )
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

      // If locationId provided, prefer a payer charge master that also matches the location
      if (locationId) {
        const locationMatch = payerFiltered.find(
          (cm) => cm.useContext?.some((uc) => uc.valueReference?.reference === `Location/${locationId}`)
        );
        if (locationMatch) {
          return {
            statusCode: 200,
            body: JSON.stringify({ chargeMaster: locationMatch, source: 'payer' }),
          };
        }
      }

      const payerChargeMaster = payerFiltered[0];
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
  }
);
