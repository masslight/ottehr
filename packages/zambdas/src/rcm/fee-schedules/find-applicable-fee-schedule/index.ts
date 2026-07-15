import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { orgIdMatchesReference } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
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

    // Helper: given a set of org-filtered fee schedules, apply date + location filtering
    const findBestMatch = (orgFeeSchedules: ChargeItemDefinition[]): ChargeItemDefinition | null => {
      const dateFiltered = orgFeeSchedules
        .filter((fs) => fs.date && fs.date <= dateOfService)
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

      if (dateFiltered.length === 0) return null;

      if (locationId) {
        const locationMatch = dateFiltered.find((fs) =>
          fs.useContext?.some((uc) => uc.valueReference?.reference === `Location/${locationId}`)
        );
        if (locationMatch) return locationMatch;

        // No location match — fall back to fee schedules with no location associations at all
        const noLocationAssociations = dateFiltered.filter(
          (fs) => !fs.useContext?.some((uc) => uc.valueReference?.reference?.startsWith('Location/'))
        );
        return noLocationAssociations[0] ?? null;
      }

      return dateFiltered[0] ?? null;
    };

    // 1. If employer org provided, try employer-specific fee schedule first
    if (employerOrganizationId) {
      const employerFeeSchedules = allFeeSchedules.filter((fs) =>
        fs.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${employerOrganizationId}`)
      );
      const employerMatch = findBestMatch(employerFeeSchedules);
      if (employerMatch) {
        return {
          statusCode: 200,
          body: JSON.stringify({ feeSchedule: employerMatch }),
        };
      }
    }

    // 2. Fall back to payer (insurance) fee schedule
    if (payerOrganizationId) {
      const payerFeeSchedules = allFeeSchedules.filter((fs) =>
        fs.useContext?.some((uc) => orgIdMatchesReference(uc.valueReference?.reference, payerOrganizationId))
      );

      const payerMatch = findBestMatch(payerFeeSchedules);
      if (payerMatch) {
        return {
          statusCode: 200,
          body: JSON.stringify({ feeSchedule: payerMatch }),
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ feeSchedule: null }),
    };
  }
);
