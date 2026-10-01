// Visit pricing as the EHR shows it (patient payments "Services provided"): which fee schedule or charge master
// applies to a visit, and the line items the visit's CPT / E&M codes price to. Pure functions over already
// loaded ChargeItemDefinitions, shared by the RCM endpoints (find-applicable-fee-schedule,
// get-charge-master-entry), the EHR (PatientPaymentsList) and the ad-hoc reports, so every one of them prices
// a visit the same way.
import { ChargeItemDefinition } from 'fhir/r4b';
import { CASE_RATE_CODE, CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL, RCM_TAG_SYSTEM } from '../../fhir/constants';
import { orgIdMatchesReference } from '../helpers';

/**
 * Finds the most applicable fee schedule for a given payer (or employer) and date of service.
 *
 * Among the fee schedules associated with the employer (first) or the payer (via useContext), selects the one
 * whose effective date (ChargeItemDefinition.date) is on or before the date of service, picking the most recent;
 * a location-specific one wins, else one with no location associations. Both active and inactive fee schedules
 * count, so historical lookups work. Null when none applies.
 */
export const findApplicableFeeSchedule = (
  allFeeSchedules: ChargeItemDefinition[],
  {
    payerOrganizationId,
    dateOfService,
    locationId,
    employerOrganizationId,
  }: {
    payerOrganizationId?: string;
    dateOfService: string;
    locationId?: string;
    employerOrganizationId?: string;
  }
): ChargeItemDefinition | null => {
  // Helper: given a set of org-filtered fee schedules, apply date + location filtering
  const findBestMatch = (orgFeeSchedules: ChargeItemDefinition[]): ChargeItemDefinition | null => {
    const dateFiltered = orgFeeSchedules
      .filter((fs) => fs.date && fs.date <= dateOfService)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

    if (dateFiltered.length === 0) return null;

    if (locationId) {
      const locationMatch = dateFiltered.find(
        (fs) => fs.useContext?.some((uc) => uc.valueReference?.reference === `Location/${locationId}`)
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
    const employerFeeSchedules = allFeeSchedules.filter(
      (fs) => fs.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${employerOrganizationId}`)
    );

    const employerMatch = findBestMatch(employerFeeSchedules);

    if (employerMatch) return employerMatch;
  }

  // 2. Fall back to payer (insurance) fee schedule
  if (payerOrganizationId) {
    const payerFeeSchedules = allFeeSchedules.filter(
      (fs) => fs.useContext?.some((uc) => orgIdMatchesReference(uc.valueReference?.reference, payerOrganizationId))
    );

    const payerMatch = findBestMatch(payerFeeSchedules);

    if (payerMatch) return payerMatch;
  }

  return null;
};

export type ChargeMasterDesignation = 'self-pay' | 'default-insurance';

/** True when get-charge-master-entry looks for an org-specific charge master before the designated one. */
export const chargeMasterEntryNeedsOrgLookup = (
  designation: ChargeMasterDesignation,
  payerOrganizationId: string | undefined,
  employerOrganizationId: string | undefined
): boolean => designation === 'default-insurance' && !!(payerOrganizationId || employerOrganizationId);

/**
 * The charge master get-charge-master-entry returns. For default-insurance with a payer / employer, the most
 * recent active org-specific charge master effective on the date (employer first, location-specific first);
 * otherwise the most recent active charge master carrying the designation tag. `orgChargeMasters` are the
 * charge-master-tagged ChargeItemDefinitions (needed only when chargeMasterEntryNeedsOrgLookup), and
 * `designatedChargeMasters` those tagged with the designation.
 */
export const findChargeMasterEntry = ({
  designation,
  payerOrganizationId,
  employerOrganizationId,
  locationId,
  cutoffDate,
  orgChargeMasters,
  designatedChargeMasters,
}: {
  designation: ChargeMasterDesignation;
  payerOrganizationId?: string;
  employerOrganizationId?: string;
  locationId?: string;
  /** The date of service (yyyy-MM-dd); the endpoint defaults it to today. */
  cutoffDate: string;
  orgChargeMasters: ChargeItemDefinition[];
  designatedChargeMasters: ChargeItemDefinition[];
}): { chargeMaster: ChargeItemDefinition | null; source: 'payer' | 'chargemaster' | null } => {
  // If looking for insurance/employer and an org is given, first look for org-specific charge masters
  if (chargeMasterEntryNeedsOrgLookup(designation, payerOrganizationId, employerOrganizationId)) {
    // Helper: find best org-specific charge master with location filtering
    const findBestOrgMatch = (orgId: string): ChargeItemDefinition | undefined => {
      const orgFiltered = orgChargeMasters
        .filter(
          (cm) =>
            cm.status === 'active' &&
            cm.useContext?.some((uc) => orgIdMatchesReference(uc.valueReference?.reference, orgId)) &&
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

      if (employerMatch) return { chargeMaster: employerMatch, source: 'payer' };
    }

    // Then try insurance payer
    if (payerOrganizationId) {
      const payerMatch = findBestOrgMatch(payerOrganizationId);

      if (payerMatch) return { chargeMaster: payerMatch, source: 'payer' };
    }
  }

  // Fall back to the designated default charge master (by tag)
  const chargeMaster =
    designatedChargeMasters
      .filter((cm) => cm.status === 'active' && cm.date && cm.date <= cutoffDate)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0] ?? null;

  return { chargeMaster, source: chargeMaster ? 'chargemaster' : null };
};

export interface VisitPricingLineItem {
  code: string;
  modifier?: string;
  description: string;
  amount: number;
  units: number;
  feeUnknown?: boolean;
}

/**
 * Prices the visit's CPT and E&M codes against a fee schedule / charge master: an exact code + first modifier
 * match first, else the code's no-modifier entry, else any entry for the code; amount × units (rounded up, at
 * least 1). A code the schedule does not list is a line with amount 0 and feeUnknown.
 */
export function buildLineItems(
  feeSchedule: ChargeItemDefinition | null | undefined,
  cptCodes:
    | { code: string; display: string; modifier?: { code: string; display: string }[]; billableUnits?: number }[]
    | undefined,
  emCode: { code: string; display: string; modifier?: { code: string; display: string }[] } | undefined
): VisitPricingLineItem[] {
  if (!feeSchedule?.propertyGroup || (!cptCodes?.length && !emCode)) return [];

  const allCodes: {
    code: string;
    display: string;
    modifier?: { code: string; display: string }[];
    billableUnits?: number;
  }[] = [...(cptCodes ?? []), ...(emCode ? [emCode] : [])];
  const items: VisitPricingLineItem[] = [];

  for (const cpt of allCodes) {
    const cptModifier = cpt.modifier?.[0]?.code;
    const { billableUnits } = cpt;

    const units =
      billableUnits != null && Number.isFinite(billableUnits) && billableUnits > 0
        ? Math.max(1, Math.ceil(billableUnits))
        : 1;

    let noModifierFallbackPg: (typeof feeSchedule.propertyGroup)[number] | undefined;
    let anyModifierFallbackPg: (typeof feeSchedule.propertyGroup)[number] | undefined;
    let exactMatched = false;

    for (const pg of feeSchedule.propertyGroup) {
      const pc = pg.priceComponent?.[0];
      if (!pc) continue;
      const fsCoding = pc.code?.coding?.find((c) => c.system === CPT_CODE_SYSTEM);
      if (!fsCoding || fsCoding.code !== cpt.code) continue;
      const fsModifier = pc.extension?.find((ext) => ext.url === CPT_MODIFIER_EXTENSION_URL)?.valueCode;
      if ((fsModifier || '') === (cptModifier || '')) {
        // Exact code + modifier match — use it immediately
        items.push({
          code: cpt.code,
          modifier: cptModifier,
          description: cpt.display || fsCoding.display || '',
          amount: (pc.amount?.value ?? 0) * units,
          units,
        });

        exactMatched = true;
        noModifierFallbackPg = undefined;
        anyModifierFallbackPg = undefined;
        break;
      }
      // Code matches but modifier doesn't — prefer no-modifier entry as fallback
      if (!fsModifier && !noModifierFallbackPg) {
        noModifierFallbackPg = pg;
      } else if (fsModifier && !anyModifierFallbackPg) {
        anyModifierFallbackPg = pg;
      }
    }

    const fallbackPg = noModifierFallbackPg ?? anyModifierFallbackPg;

    if (fallbackPg) {
      // No exact match found — fall back to first entry with matching code
      const pc = fallbackPg.priceComponent![0];
      const fsCoding = pc.code?.coding?.find((c) => c.system === CPT_CODE_SYSTEM);

      items.push({
        code: cpt.code,
        modifier: cptModifier,
        description: cpt.display || fsCoding?.display || '',
        amount: (pc.amount?.value ?? 0) * units,
        units,
      });
    } else if (!exactMatched) {
      // Code not found in fee schedule — include with unknown fee
      items.push({
        code: cpt.code,
        modifier: cptModifier,
        description: cpt.display || '',
        amount: 0,
        units,
        feeUnknown: true,
      });
    }
  }

  return items;
}

/** A case-rate fee schedule prices the visit as one flat amount (its first entry), not per code. */
export const isCaseRateFeeSchedule = (feeSchedule: ChargeItemDefinition | null | undefined): boolean =>
  feeSchedule?.meta?.tag?.some((t) => t.system === RCM_TAG_SYSTEM && t.code === CASE_RATE_CODE) ?? false;

/** The flat case rate of a case-rate fee schedule; null for any other schedule. */
export const getCaseRateInfo = (
  feeSchedule: ChargeItemDefinition | null | undefined
): { amount: number; comment: string } | null => {
  if (!isCaseRateFeeSchedule(feeSchedule) || !feeSchedule?.propertyGroup) return null;
  const pg = feeSchedule.propertyGroup[0];
  const pc = pg?.priceComponent?.[0];

  if (!pc) return null;

  return {
    amount: pc.amount?.value ?? 0,
    comment: pc.code?.text ?? '',
  };
};
