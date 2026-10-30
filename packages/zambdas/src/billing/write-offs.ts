import { Extension, PaymentNotice } from 'fhir/r4b';
import { getExtension, getExtensionValue } from 'utils/lib/fhir/helpers';
import { ottehrExtensionUrl, ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { ClaimWriteOff } from 'utils/lib/types/data/billing/billing.types';
import { fetchResourcesGrouped } from './claim-amounts';
import { BillingOystehr } from './shared';

export const WRITE_OFF_SYSTEM = ottehrIdentifierSystem('billing-write-off');
export const WRITE_OFF_PARTY_EXT_URL = ottehrExtensionUrl('billing-write-off-party');
export const WRITE_OFF_PAYER_EXT_URL = ottehrExtensionUrl('billing-write-off-payer');
export const WRITE_OFF_REASON_EXT_URL = ottehrExtensionUrl('billing-write-off-reason');
export const WRITE_OFF_NOTE_EXT_URL = ottehrExtensionUrl('billing-write-off-note');
export const WRITE_OFF_VOID_EXT_URL = ottehrExtensionUrl('billing-write-void');

export async function fetchWriteOffs(oystehr: BillingOystehr, claimId: string): Promise<PaymentNotice[]> {
  return (
    await oystehr.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [
        {
          name: 'request',
          value: `Claim/${claimId}`,
        },
        {
          name: 'identifier',
          value: `${WRITE_OFF_SYSTEM}|`,
        },
      ],
    })
  ).unbundle();
}

export async function fetchWriteOffsByClaimIds(
  oystehr: BillingOystehr,
  claimIds: string[]
): Promise<Map<string, PaymentNotice[]>> {
  return fetchResourcesGrouped<PaymentNotice>({
    oystehr,
    resourceType: 'PaymentNotice',
    ids: claimIds,
    buildParam: (batch) => [
      {
        name: 'request',
        value: batch.map((id) => `Claim/${id}`).join(','),
      },
      {
        name: 'identifier',
        value: `${WRITE_OFF_SYSTEM}|`,
      },
    ],
    groupKeyOf: (notice) => notice.request?.reference?.replace('Claim/', ''),
    batchSize: 100,
  });
}

export function writeOffFromPaymentNotice(notice: PaymentNotice): ClaimWriteOff {
  const voidExt = getExtension(notice, WRITE_OFF_VOID_EXT_URL);
  return {
    id: notice.id!,
    amount: notice.amount.value ?? 0,
    date: notice.paymentDate ?? notice.created,
    status: notice.status,
    party: getExtensionValue(notice, WRITE_OFF_PARTY_EXT_URL, 'valueString') ?? '',
    payer: getExtensionValue(notice, WRITE_OFF_PAYER_EXT_URL, 'valueString') ?? '',
    reason: getExtensionValue(notice, WRITE_OFF_REASON_EXT_URL, 'valueString') ?? '',
    note: getExtensionValue(notice, WRITE_OFF_NOTE_EXT_URL, 'valueString') ?? '',
    voidDate: getExtensionValue(voidExt, 'date', 'valueDateTime') ?? '',
    voidReason: getExtensionValue(voidExt, 'reason', 'valueString') ?? '',
    voidNote: getExtensionValue(voidExt, 'note', 'valueString') ?? '',
    voidActor: getExtensionValue(voidExt, 'actor', 'valueString') ?? '',
  };
}

/**
 * Sums the amounts from write-offs. There are 2 possible resource layouts here:
 *  - normal write off -- positive value
 *  - voided write off -- positive value, status is 'cancelled'
 * Voided are filtered out, normal write-off adds positive amounts.
 *
 * @param notices PaymentNotice resources that are expected to be for write-offs
 * @returns total
 */
export function sumWriteOffs(notices: PaymentNotice[]): number {
  return notices.filter((n) => n.status === 'active').reduce((sum, notice) => sum + (notice.amount?.value ?? 0), 0);
}

export const buildWriteOffVoidExtension = ({
  reason,
  date,
  note,
  actor,
}: {
  date: string;
  reason?: string;
  note?: string;
  actor?: string;
}): Extension => ({
  url: WRITE_OFF_VOID_EXT_URL,
  extension: [
    { url: 'date', valueDateTime: date },
    ...(reason ? [{ url: 'reason', valueString: reason }] : []),
    ...(note ? [{ url: 'note', valueString: note }] : []),
    ...(actor ? [{ url: 'actor', valueString: actor }] : []),
  ],
});
