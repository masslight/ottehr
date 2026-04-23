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

let m2mToken: string;
export const index = wrapHandler(
  'find-applicable-charge-master',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { payerOrganizationId, dateOfService, locationId, employerOrganizationId, secrets } =
      validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    // Fetch all active charge masters tagged as charge-master
    const allResults = await oystehr.fhir.search<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      params: [
        { name: '_tag', value: `${RCM_TAG_SYSTEM}|charge-master` },
        { name: 'status', value: 'active' },
      ],
    });

    const allChargeMasters = allResults.unbundle();

    // Helper: given org-filtered charge masters, apply location filtering and find best match
    const findBestOrgMatch = (orgChargeMasters: ChargeItemDefinition[]): ChargeItemDefinition | undefined => {
      if (locationId) {
        const locationMatch = findMostRecentEffective(
          orgChargeMasters.filter(
            (cm) => cm.useContext?.some((uc) => uc.valueReference?.reference === `Location/${locationId}`)
          ),
          dateOfService
        );
        if (locationMatch) return locationMatch;

        // No location match — fall back to org charge masters with no location associations
        const noLocationAssociations = orgChargeMasters.filter(
          (cm) => !cm.useContext?.some((uc) => uc.valueReference?.reference?.startsWith('Location/'))
        );
        return findMostRecentEffective(noLocationAssociations, dateOfService);
      }
      return findMostRecentEffective(orgChargeMasters, dateOfService);
    };

    // 1. Try employer-specific charge master (highest priority when employer is provided)
    if (employerOrganizationId) {
      const employerSpecific = allChargeMasters.filter(
        (cm) => cm.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${employerOrganizationId}`)
      );
      const employerMatch = findBestOrgMatch(employerSpecific);
      if (employerMatch) {
        return {
          statusCode: 200,
          body: JSON.stringify({ chargeMaster: employerMatch, source: 'employer-specific' }),
        };
      }
    }

    // 2. Try payer-specific charge master
    if (payerOrganizationId) {
      const payerSpecific = allChargeMasters.filter(
        (cm) => cm.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${payerOrganizationId}`)
      );
      const payerMatch = findBestOrgMatch(payerSpecific);
      if (payerMatch) {
        return {
          statusCode: 200,
          body: JSON.stringify({ chargeMaster: payerMatch, source: 'payer-specific' }),
        };
      }
    }

    // 3. Try default-insurance designated charge masters
    if (payerOrganizationId || employerOrganizationId) {
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

    // 4. Self-pay fallback (when no payer or employer provided)
    if (!payerOrganizationId && !employerOrganizationId) {
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
  }
);
