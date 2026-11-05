import Oystehr from '@oystehr/sdk';
import { Claim, PaymentNotice } from 'fhir/r4b';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { PatientPaymentDTO } from 'utils/lib/types/api/patient-payment-types';
import { PatientPaymentVisit } from 'utils/lib/types/api/patient-payment-visits.types';
import { BillingPatientAccountPayment, BillingPatientPaymentMethod } from 'utils/lib/types/data/billing/billing.types';
import { fetchResourcesGrouped } from './claim-amounts';
import { getClaimServiceDate } from './claim-search';
import { invoiceIdForPaymentNotice } from './patient-payments';

// Shared by the patient account payment list and the single-payment lookup.

const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');

export const fetchClaimsByEncounter = (
  billingOystehr: Oystehr,
  encounterIds: string[]
): Promise<Map<string, Claim[]>> =>
  fetchResourcesGrouped<Claim>({
    oystehr: billingOystehr,
    resourceType: 'Claim',
    ids: encounterIds,
    buildParam: (batch) => [
      { name: 'identifier', value: batch.map((id) => `${CLAIM_ENCOUNTER_ID_SYSTEM}|${id}`).join(',') },
    ],
    groupKeyOf: (claim) =>
      claim.identifier?.find((identifier) => identifier.system === CLAIM_ENCOUNTER_ID_SYSTEM)?.value,
  });

// One visit's payment DTOs as account payments, each with the time it was recorded for ordering.
export const toAccountPayments = (params: {
  visit: PatientPaymentVisit;
  // every payment notice on the visit, which the claim and method are resolved against
  notices: PaymentNotice[];
  dtos: PatientPaymentDTO[];
  claims: Claim[];
}): { payment: BillingPatientAccountPayment; recordedISO: string }[] => {
  const { visit, notices, dtos, claims } = params;
  const claim = claimForPayments(claims, notices);
  return dtos.map((dto) => ({
    recordedISO: dto.dateISO,
    payment: {
      ...dto,
      dateISO: notices.find((notice) => notice.id === dto.fhirPaymentNotificationId)?.paymentDate ?? dto.dateISO,
      recordedDateISO: dto.dateISO,
      method: methodOf(dto, notices),
      encounterId: visit.encounterId,
      appointmentId: visit.appointmentId,
      visitDateISO: visit.visitDateISO,
      claimId: claim?.id,
      claimServiceDate: claim ? getClaimServiceDate(claim) : undefined,
    },
  }));
};

// the claim the billing notices were reconciled to, else the encounter's only claim
const claimForPayments = (claims: Claim[], notices: PaymentNotice[]): Claim | undefined => {
  const linkedClaimIds = new Set(
    notices.flatMap((notice) => getIdFromReference(notice.request?.reference, 'Claim') ?? [])
  );
  return claims.find((claim) => claim.id && linkedClaimIds.has(claim.id)) ?? claims[0];
};

const methodOf = (payment: PatientPaymentDTO, notices: PaymentNotice[]): BillingPatientPaymentMethod => {
  const notice = notices.find((candidate) => candidate.id === payment.fhirPaymentNotificationId);
  return notice && invoiceIdForPaymentNotice(notice) ? 'invoice' : payment.paymentMethod;
};
