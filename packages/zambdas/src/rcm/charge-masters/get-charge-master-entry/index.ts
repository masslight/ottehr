import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { chargeMasterEntryNeedsOrgLookup, findChargeMasterEntry } from 'utils/lib/helpers/rcm/visit-pricing';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient, RCM_TAG_SYSTEM } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'get-charge-master-entry',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { designation, payerOrganizationId, dateOfService, locationId, employerOrganizationId, secrets } =
      validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const cutoffDate = dateOfService ?? new Date().toISOString().split('T')[0];

    // If looking for insurance/employer and an org is given, first look for org-specific charge masters
    const orgChargeMasters = chargeMasterEntryNeedsOrgLookup(designation, payerOrganizationId, employerOrganizationId)
      ? (
          await oystehr.fhir.search<ChargeItemDefinition>({
            resourceType: 'ChargeItemDefinition',
            params: [
              {
                name: '_tag',
                value: `${RCM_TAG_SYSTEM}|charge-master`,
              },
            ],
          })
        ).unbundle()
      : [];

    const orgMatch = findChargeMasterEntry({
      designation,
      payerOrganizationId,
      employerOrganizationId,
      locationId,
      cutoffDate,
      orgChargeMasters,
      designatedChargeMasters: [],
    });

    if (orgMatch.source === 'payer') {
      return {
        statusCode: 200,
        body: JSON.stringify({ chargeMaster: orgMatch.chargeMaster, source: 'payer' }),
      };
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

    const { chargeMaster, source } = findChargeMasterEntry({
      designation,
      locationId,
      cutoffDate,
      orgChargeMasters: [],
      designatedChargeMasters: designatedResults.unbundle(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        chargeMaster,
        source,
      }),
    };
  }
);
