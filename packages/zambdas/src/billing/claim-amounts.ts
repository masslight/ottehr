import Oystehr from '@oystehr/sdk';
import { ClaimResponse, ClaimResponseItemAdjudication } from 'fhir/r4b';

export const OYSTEHR_ADJUDICATION_SYSTEM = 'https://terminology.fhir.oystehr.com/CodeSystem/adjudication';
export const X12_ADJUSTMENT_GROUP_SYSTEM = 'https://x12.org/codes/claim-adjustment-group-codes';
export const ADJUDICATION_CODES = {
  PAID: 'paid',
  ALLOWED: 'allowed',
  ALLOWED_X12: 'B6',
} as const;
export const ADJUSTMENT_GROUP_PATIENT_RESPONSIBILITY = 'PR';

export interface ClaimResponseAmounts {
  paid: number;
  // undefined = the ClaimResponse carries no allowed data (distinct from an explicit 0)
  allowed: number | undefined;
  // undefined = the ClaimResponse carries no adjudication data at all, so PR can't be read off it
  patientResp: number | undefined;
}

export interface ClaimPaymentSummary {
  allowed: number;
  insurancePaid: number;
  patientResp: number;
  patientPaid: number;
  balance: number;
  adjudicated: boolean;
}

function allAdjudications(claimResponse: ClaimResponse): ClaimResponseItemAdjudication[] {
  return [
    ...(claimResponse.item ?? []).flatMap((item) => item.adjudication ?? []),
    ...(claimResponse.addItem ?? []).flatMap((item) => item.adjudication ?? []),
  ];
}

function adjudicationCode(adj: ClaimResponseItemAdjudication): string | undefined {
  return adj.category?.coding?.[0]?.code;
}

function sumAmounts(adjudications: ClaimResponseItemAdjudication[]): number {
  return adjudications.reduce((sum, adj) => sum + (adj.amount?.value ?? 0), 0);
}

export function extractClaimResponseAmounts(claimResponse: ClaimResponse): ClaimResponseAmounts {
  const adjudications = allAdjudications(claimResponse);

  const totalPaid = claimResponse.total?.find((t) => t.category?.coding?.[0]?.code === ADJUDICATION_CODES.PAID)?.amount
    ?.value;
  const paid =
    totalPaid ?? sumAmounts(adjudications.filter((adj) => adjudicationCode(adj) === ADJUDICATION_CODES.PAID));

  const allowedCodes: string[] = [ADJUDICATION_CODES.ALLOWED, ADJUDICATION_CODES.ALLOWED_X12];
  const allowedAdjudications = adjudications.filter((adj) => allowedCodes.includes(adjudicationCode(adj) ?? ''));
  const allowed = allowedAdjudications.length > 0 ? sumAmounts(allowedAdjudications) : undefined;

  const patientResp =
    adjudications.length > 0
      ? sumAmounts(adjudications.filter((adj) => adjudicationCode(adj) === ADJUSTMENT_GROUP_PATIENT_RESPONSIBILITY))
      : undefined;

  return {
    paid,
    allowed,
    patientResp,
  };
}

export function summarizeClaimPayments(claimResponses: ClaimResponse[], billed: number): ClaimPaymentSummary {
  // patientPaid comes from the patient-payments subsystem, which is not wired yet
  const patientPaid = 0;

  if (claimResponses.length === 0) {
    return {
      allowed: 0,
      insurancePaid: 0,
      patientResp: 0,
      patientPaid,
      balance: billed,
      adjudicated: false,
    };
  }

  const sorted = [...claimResponses].sort(
    (a, b) =>
      (a.created ?? '').localeCompare(b.created ?? '') ||
      (a.meta?.lastUpdated ?? '').localeCompare(b.meta?.lastUpdated ?? '')
  );
  const amounts = sorted.map(extractClaimResponseAmounts);

  const insurancePaid = amounts.reduce((sum, a) => sum + a.paid, 0);
  const allowed = amounts.findLast((a) => a.allowed !== undefined)?.allowed ?? 0;
  const latestPatientResp = amounts[amounts.length - 1].patientResp;
  // fallback for adjudications without CAS data, wont go negative
  const patientResp = latestPatientResp ?? Math.max(allowed - insurancePaid - patientPaid, 0);

  return {
    allowed,
    insurancePaid,
    patientResp,
    patientPaid,
    balance: patientResp - patientPaid,
    adjudicated: true,
  };
}

const BATCH = 100;
// Fetch every matched ClaimResponse for the given claims, grouped by claim id. Unmatched ERA
// ClaimResponses never carry a Claim/{id} request reference, so this returns matched ones only.
export async function fetchClaimResponsesByClaimIds(
  oystehr: Oystehr,
  claimIds: string[]
): Promise<Map<string, ClaimResponse[]>> {
  const byClaimId = new Map<string, ClaimResponse[]>();
  const ids = [...new Set(claimIds)];
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH).map((id) => `Claim/${id}`);
    const bundle = await oystehr.fhir.search<ClaimResponse>({
      resourceType: 'ClaimResponse',
      params: [
        {
          name: 'request',
          value: batch.join(','),
        },
        {
          name: '_count',
          value: '1000',
        },
      ],
    });
    for (const claimResponse of bundle.unbundle()) {
      const claimId = claimResponse.request?.reference?.replace('Claim/', '');
      if (!claimId) continue;
      const list = byClaimId.get(claimId) ?? [];
      list.push(claimResponse);
      byClaimId.set(claimId, list);
    }
  }
  return byClaimId;
}
