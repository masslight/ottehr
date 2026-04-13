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
    const { payerOrganizationId, dateOfService, secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    // Fetch all fee schedules (active and inactive) for historical lookups
    const allResults = await oystehr.fhir.search<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      params: [{ name: '_tag', value: `${RCM_TAG_SYSTEM}|fee-schedule` }],
    });

    const allFeeSchedules = allResults.unbundle();

    // Filter to those associated with this payer
    const payerFeeSchedules = allFeeSchedules.filter(
      (fs) => fs.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${payerOrganizationId}`)
    );

    if (payerFeeSchedules.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ feeSchedule: null }),
      };
    }

    // Find the one with the most recent effective date on or before the date of service
    const applicable = payerFeeSchedules
      .filter((fs) => fs.date && fs.date <= dateOfService)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

    return {
      statusCode: 200,
      body: JSON.stringify({ feeSchedule: applicable[0] ?? null }),
    };
  }
);
