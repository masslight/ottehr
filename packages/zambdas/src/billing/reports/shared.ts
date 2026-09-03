import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse, Location, Organization, PaymentReconciliation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { isValidUUID } from 'utils/lib/validation/helper';
import { stripeAccountIdRegex } from 'utils/lib/validation/regex';
import { fetchAllPages } from '../../shared/fhir';
import { STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../shared';

export const ERA_PAGE_SIZE = 200;
export const CLAIM_BATCH_SIZE = 100;
export const UNKNOWN_PAYER_NAME = 'Unknown Payer';
export const WATERFALL_UNKNOWN_MONTH = 'unknown';

// Platform account + connected accounts from Organization identifiers and Location
// schedule-owner extensions; candidates verified against Stripe (test data carries junk ids).
export async function listStripeAccounts(
  oystehr: Oystehr,
  untaggedClient: Oystehr,
  stripe: Stripe
): Promise<(string | undefined)[]> {
  const orgs: Organization[] = [];
  const fetchOrgs = fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        { name: '_elements', value: 'id,identifier' },
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    orgs.push(...bundle.unbundle());
    return bundle;
  }, 200);
  const locations: Location[] = [];
  const fetchLocations = fetchAllPages(async (offset, count) => {
    const bundle = await untaggedClient.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        { name: '_elements', value: 'id,extension' },
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    locations.push(...bundle.unbundle());
    return bundle;
  }, 200);
  const [platformAccount] = await Promise.all([stripe.accounts.retrieve(), fetchOrgs, fetchLocations]);

  const candidates = new Set(
    [
      ...orgs
        .flatMap((org) => org.identifier ?? [])
        .filter((identifier) => identifier.system === STRIPE_ACCOUNT_IDENTIFIER_SYSTEM)
        .map((identifier) => identifier.value),
      ...locations.map(
        (location) =>
          location.extension?.find((ext) => ext.url === SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)?.valueString
      ),
    ].filter((value): value is string => !!value && value !== platformAccount.id && stripeAccountIdRegex.test(value))
  );

  const connectedAccounts: string[] = [];
  const unreachable: string[] = [];
  for (const account of candidates) {
    try {
      await stripe.accounts.retrieve(account);
      connectedAccounts.push(account);
    } catch {
      unreachable.push(account);
    }
  }
  console.log(
    `listStripeAccounts: ${connectedAccounts.length} connected + platform ` +
      `(${orgs.length} orgs, ${locations.length} locations scanned)`,
    JSON.stringify({ platform: platformAccount.id, connected: connectedAccounts, unreachable })
  );
  return [undefined, ...connectedAccounts];
}

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
  await fetchAllPages(
    async (offset, count) => {
      const bundle = await eraReadClient.fhir.search<PaymentReconciliation>({
        resourceType: 'PaymentReconciliation',
        params: [
          { name: '_count', value: String(count) },
          { name: '_offset', value: String(offset) },
        ],
      });
      eras.push(...bundle.unbundle());
      return bundle;
    },
    ERA_PAGE_SIZE,
    { failOnLimit: true }
  );
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
