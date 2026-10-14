import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { findApplicableFeeSchedule } from 'utils/lib/helpers/rcm/visit-pricing';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient, RCM_TAG_SYSTEM } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

/**
 * Finds the most applicable fee schedule for a given payer and date of service.
 *
 * Searches all fee-schedule-tagged ChargeItemDefinitions that are associated with the
 * given payer (via useContext), then selects the one whose effective date (ChargeItemDefinition.date)
 * is on or before the date of service, picking the most recent. Includes both active and
 * inactive fee schedules so historical lookups work.
 *
 * Returns null if no fee schedule is found for the payer.
 */

let m2mToken: string;
export const index = wrapHandler(
  'find-applicable-fee-schedule',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { payerOrganizationId, dateOfService, locationId, employerOrganizationId, secrets } =
      validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    // Fetch all fee schedules (active and inactive) for historical lookups
    const allResults = await oystehr.fhir.search<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      params: [{ name: '_tag', value: `${RCM_TAG_SYSTEM}|fee-schedule` }],
    });

    const allFeeSchedules = allResults.unbundle();

    const feeSchedule = findApplicableFeeSchedule(allFeeSchedules, {
      payerOrganizationId,
      dateOfService,
      locationId,
      employerOrganizationId,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ feeSchedule }),
    };
  }
);
