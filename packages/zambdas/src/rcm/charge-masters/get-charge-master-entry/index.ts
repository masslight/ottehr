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
    const { designation, payerOrganizationId, dateOfService, locationId, employerOrganizationId, secrets } =
      validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const cutoffDate = dateOfService ?? new Date().toISOString().split('T')[0];

    // If looking for insurance/employer and an org is given, first look for org-specific charge masters
    if (designation === 'default-insurance' && (payerOrganizationId || employerOrganizationId)) {
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

      // Helper: find best org-specific charge master with location filtering
      const findBestOrgMatch = (orgId: string): ChargeItemDefinition | undefined => {
        const orgFiltered = chargeMasters
          .filter(
            (cm) =>
              cm.status === 'active' &&
              cm.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${orgId}`) &&
              cm.date &&
              cm.date <= cutoffDate
          )
          .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

        if (orgFiltered.length === 0) return undefined;

        if (locationId) {
          const locationMatch = orgFiltered.find(
            (cm) => cm.useContext?.some((uc) => uc.valueReference?.reference === `Location/${locationId}`)
          );
          if (locationMatch) return locationMatch;

          // No location match — fall back to org charge masters with no location associations
          const noLocationAssociations = orgFiltered.filter(
            (cm) => !cm.useContext?.some((uc) => uc.valueReference?.reference?.startsWith('Location/'))
          );
          return noLocationAssociations[0];
        }

        return orgFiltered[0];
      };

      // Try employer first (higher priority)
      if (employerOrganizationId) {
        const employerMatch = findBestOrgMatch(employerOrganizationId);
        if (employerMatch) {
          return {
            statusCode: 200,
            body: JSON.stringify({ chargeMaster: employerMatch, source: 'payer' }),
          };
        }
      }

      // Then try insurance payer
      if (payerOrganizationId) {
        const payerMatch = findBestOrgMatch(payerOrganizationId);
        if (payerMatch) {
          return {
            statusCode: 200,
            body: JSON.stringify({ chargeMaster: payerMatch, source: 'payer' }),
          };
        }
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
