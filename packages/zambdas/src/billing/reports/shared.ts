import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse, PaymentReconciliation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { isValidUUID } from 'utils/lib/validation/helper';
import { fetchAllPages } from '../../shared/fhir';

export const ERA_PAGE_SIZE = 200;
export const CLAIM_BATCH_SIZE = 100;
export const UNKNOWN_PAYER_NAME = 'Unknown Payer';
export const WATERFALL_UNKNOWN_MONTH = 'unknown';

export const toDay = (value?: string): string | null =>
  value ? DateTime.fromISO(value, { setZone: true }).toISODate() : null;

export const toMonth = (value?: string): string | null => toDay(value)?.slice(0, 7) ?? null;

// DOS as the ERA itself reports it: the ClaimResponse's contained submitted Claim (item dates, else
// created). Used when the billing Claim can't be resolved, and as the fallback for matched ones.
export function containedClaimServiceDay(claimResponse: ClaimResponse): string | null {
  const contained = claimResponse.contained?.find((resource): resource is Claim => resource.resourceType === 'Claim');
  if (!contained) return null;
  return toDay(contained.item?.[0]?.servicedPeriod?.start ?? contained.item?.[0]?.servicedDate ?? contained.created);
}

// "Name (payerId)" as written by the ERA converters, e.g. "United Health Care (87726)"
export function eraReportedPayerName(claimResponses: ClaimResponse[]): string | undefined {
  const display = claimResponses.map((cr) => cr.insurer?.display).find((name) => !!name && name !== 'Unknown');
  return display?.replace(/\s*\([^)]*\)\s*$/, '');
}

// Best-known name per payer ref harvested across every remit; some ERAs carry the payer's name
// while others under the same ref carry none, so the map lets any of them share it.
export function payerNamesByRef(claimResponses: ClaimResponse[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const claimResponse of claimResponses) {
    const ref = claimResponse.insurer?.reference;
    const display = claimResponse.insurer?.display;
    if (!ref || !display || display === 'Unknown' || names.has(ref)) continue;
    names.set(ref, display.replace(/\s*\([^)]*\)\s*$/, ''));
  }
  return names;
}

export function checkDateInRange(era: PaymentReconciliation, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const day = toDay(era.paymentDate ?? era.created);
  if (!day) return false;
  const fromDay = toDay(from);
  const toDayValue = toDay(to);
  if (fromDay && day < fromDay) return false;
  if (toDayValue && day > toDayValue) return false;
  return true;
}

export const eraCheckMonth = (era: PaymentReconciliation): string =>
  toMonth(era.paymentDate ?? era.created) ?? WATERFALL_UNKNOWN_MONTH;

export const eraPayerRef = (era: PaymentReconciliation, claimResponses: ClaimResponse[]): string | undefined =>
  era.paymentIssuer?.reference ?? claimResponses.find((cr) => cr.insurer?.reference)?.insurer?.reference;

// payer list URLs end in the payer ID; keeps rows distinguishable when RCM lookup is forbidden
export const payerIdFromRef = (ref?: string): string | undefined => ref?.match(/\/payer\/([^/?]+)/)?.[1];

export const claimResponseClaimId = (claimResponse: ClaimResponse): string | undefined =>
  claimResponse.request?.reference?.replace('Claim/', '');

export function claimServiceDay(claim: Claim): string | null {
  return toDay(claim.item?.[0]?.servicedPeriod?.start ?? claim.item?.[0]?.servicedDate ?? claim.created);
}

// The DOS used everywhere in the payments report: the matched billing Claim's, else the ERA's own.
export function claimResponseServiceDay(
  claimResponse: ClaimResponse,
  partialClaimsById: Map<string, Claim>
): string | null {
  const claimId = claimResponseClaimId(claimResponse);
  const matched = claimId ? partialClaimsById.get(claimId) : undefined;
  return (matched ? claimServiceDay(matched) : null) ?? containedClaimServiceDay(claimResponse);
}

export async function fetchAllEras(eraReadClient: Oystehr): Promise<PaymentReconciliation[]> {
  const eras: PaymentReconciliation[] = [];
  await fetchAllPages(async (offset, count) => {
    const bundle = await eraReadClient.fhir.search<PaymentReconciliation>({
      resourceType: 'PaymentReconciliation',
      params: [
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    eras.push(...bundle.unbundle());
    return bundle;
  }, ERA_PAGE_SIZE);
  return eras;
}

// Partial Claims (id/item/created/identifier) for DOS resolution and PCN fallback; billing FHIR store.
export async function fetchPartialClaimsById(oystehr: Oystehr, claimIds: string[]): Promise<Map<string, Claim>> {
  const claimsById = new Map<string, Claim>();
  // unmatched ERA ClaimResponses carry logical/identifier request references, not Claim/{uuid}
  const uniqueIds = [...new Set(claimIds)].filter(isValidUUID);
  for (let i = 0; i < uniqueIds.length; i += CLAIM_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + CLAIM_BATCH_SIZE);
    const bundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        { name: '_id', value: batch.join(',') },
        { name: '_elements', value: 'id,item,created,identifier' },
        { name: '_count', value: String(batch.length) },
      ],
    });
    for (const claim of bundle.unbundle()) {
      if (claim.id) claimsById.set(claim.id, claim);
    }
  }
  return claimsById;
}
