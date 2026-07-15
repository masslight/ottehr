import Oystehr from '@oystehr/sdk';
import { Claim, Patient, Provenance } from 'fhir/r4b';
import {
  AR_STAGE,
  chunkThings,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  CLAIM_STATUS_FIELDS_BY_KEY,
  CLAIM_STATUS_TAG_SYSTEMS,
  ClaimFieldChange,
  ClaimStatusValues,
  formatClaimStatusValue,
  getClaimStatusValues,
  PatientArClaimItem,
  removePrefix,
  SearchBillingPatientArClaimsResponse,
} from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { fetchAllPages } from '../../shared';
import { ClaimPaymentSummary, fetchClaimResponsesByClaimIds, summarizeClaimPayments } from '../claim-amounts';
import { fhirName } from '../shared';

const CLAIM_SCAN_PAGE_SIZE = 200;
const PROVENANCE_BATCH = 100;
const DEFAULT_PAGE_SIZE = 25;

export interface SearchPatientArClaimsParams {
  billingClient: Oystehr;
  eraReadClient: Oystehr;
  patientId?: string;
  claimIds?: string[];
  includeZeroBalance?: boolean;
  offset?: number;
  pageSize?: number;
}

export async function searchPatientArClaims(
  params: SearchPatientArClaimsParams
): Promise<SearchBillingPatientArClaimsResponse> {
  const { billingClient, eraReadClient, patientId, claimIds, includeZeroBalance } = params;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const offset = params.offset ?? 0;

  const claims = await fetchPatientArStageClaims({
    billingClient,
    patientId,
    claimIds,
  });
  const claimResponsesByClaimId = await fetchClaimResponsesByClaimIds(
    eraReadClient,
    claims.map((c) => c.id).filter(Boolean) as string[]
  );

  const candidates = claims.map((claim) => {
    const claimId = claim.id ?? '';
    return {
      claim,
      claimId,
      patientId: claimPatientId(claim),
      statuses: getClaimStatusValues(claim),
      payments: summarizeClaimPayments(claimResponsesByClaimId.get(claimId) ?? [], claim.total?.value ?? 0),
    };
  });
  const matches = candidates.filter(({ statuses, payments }) =>
    includeZeroBalance ? isInActivePatientArStage(statuses) : isActivePatientArClaim(statuses, payments)
  );
  matches.sort(
    (a, b) =>
      claimServiceDate(b.claim).localeCompare(claimServiceDate(a.claim)) ||
      (a.claim.id ?? '').localeCompare(b.claim.id ?? '')
  );
  const page = matches.slice(offset, offset + pageSize);

  const [patientsById, provenancesByClaimId] = await Promise.all([
    fetchPatientsById(
      billingClient,
      page.map(({ patientId }) => patientId)
    ),
    fetchClaimProvenances(billingClient, page.map(({ claimId }) => claimId).filter(Boolean)),
  ]);

  const items = page.map(({ claim, claimId, patientId, payments }) =>
    mapToPatientArClaimItem({
      claim,
      patient: patientsById.get(patientId),
      payments,
      finalizationDate: deriveFinalizationDate(provenancesByClaimId.get(claimId) ?? [], claim),
    })
  );

  return {
    claims: items,
    total: matches.length,
    offset,
    pageSize,
  };
}

export function isInActivePatientArStage(statuses: ClaimStatusValues): boolean {
  if (statuses.arStage !== AR_STAGE.patient) return false;
  if (statuses.patientArStatus === 'finalized') return false;
  return statuses.insuranceArStatus === 'finalized' || statuses.insuranceArStatus === '';
}

export function isActivePatientArClaim(statuses: ClaimStatusValues, payments: ClaimPaymentSummary): boolean {
  return isInActivePatientArStage(statuses) && payments.balance > 0;
}

export function deriveFinalizationDate(provenances: Provenance[], claim: Claim): string {
  const insuranceFinalizedLabel = formatClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY.insuranceArStatus, 'finalized');
  const patientArStageLabel = formatClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY.arStage, AR_STAGE.patient);

  let insuranceFinalizedAt: string | undefined;
  let enteredPatientArAt: string | undefined;
  for (const provenance of provenances) {
    const recorded = provenance.recorded;
    if (!recorded) continue;
    for (const change of parseChangeSet(provenance)) {
      if (
        change.field === 'status.insuranceArStatus' &&
        change.newValue === insuranceFinalizedLabel &&
        (!insuranceFinalizedAt || recorded > insuranceFinalizedAt)
      ) {
        insuranceFinalizedAt = recorded;
      }
      if (
        change.field === 'status.arStage' &&
        change.newValue === patientArStageLabel &&
        (!enteredPatientArAt || recorded > enteredPatientArAt)
      ) {
        enteredPatientArAt = recorded;
      }
    }
  }
  return insuranceFinalizedAt ?? enteredPatientArAt ?? claim.meta?.lastUpdated ?? claim.created ?? '';
}

function parseChangeSet(provenance: Provenance): ClaimFieldChange[] {
  const diffString = provenance.extension?.find((e) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)?.valueString;
  if (!diffString) return [];
  try {
    const parsed = JSON.parse(diffString);
    return Array.isArray(parsed) ? (parsed as ClaimFieldChange[]) : [];
  } catch {
    return [];
  }
}

export interface MapToPatientArClaimItemParams {
  claim: Claim;
  patient: Patient | undefined;
  payments: ClaimPaymentSummary;
  finalizationDate: string;
}

export function mapToPatientArClaimItem(params: MapToPatientArClaimItemParams): PatientArClaimItem {
  const { claim, patient, payments, finalizationDate } = params;
  return {
    claimId: claim.id ?? '',
    patientId: claimPatientId(claim),
    patientName: fhirName(patient),
    patientDob: patient?.birthDate ?? '',
    encounterId: getClaimIdentifierValue(claim, 'claim-encounter-id'),
    appointmentId: getClaimIdentifierValue(claim, 'claim-appointment-id'),
    serviceDate: claimServiceDate(claim),
    finalizationDate,
    billed: claim.total?.value ?? 0,
    allowed: payments.allowed,
    insurancePaid: payments.insurancePaid,
    patientResp: payments.patientResp,
    patientPaid: payments.patientPaid,
    balance: payments.balance,
    adjudicated: payments.adjudicated,
  };
}

function claimPatientId(claim: Claim): string {
  return removePrefix('Patient/', claim.patient?.reference ?? '') ?? '';
}

function getClaimIdentifierValue(claim: Claim, name: 'claim-encounter-id' | 'claim-appointment-id'): string | null {
  return claim.identifier?.find((identifier) => identifier.system === ottehrIdentifierSystem(name))?.value ?? null;
}

function claimServiceDate(claim: Claim): string {
  return claim.item?.[0]?.servicedPeriod?.start ?? claim.item?.[0]?.servicedDate ?? claim.created ?? '';
}

async function fetchPatientArStageClaims(params: {
  billingClient: Oystehr;
  patientId?: string;
  claimIds?: string[];
}): Promise<Claim[]> {
  const { billingClient, patientId, claimIds } = params;
  const searchParams = [
    {
      name: '_tag',
      value: `${CLAIM_STATUS_TAG_SYSTEMS.arStage}|${AR_STAGE.patient}`,
    },
    {
      name: '_sort',
      value: '-created,_id',
    },
  ];
  if (patientId) {
    searchParams.push({
      name: 'patient',
      value: `Patient/${patientId}`,
    });
  }
  if (claimIds && claimIds.length > 0) {
    searchParams.push({
      name: '_id',
      value: claimIds.join(','),
    });
  }

  const claims: Claim[] = [];
  await fetchAllPages(async (offset, count) => {
    const bundle = await billingClient.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        ...searchParams,
        {
          name: '_count',
          value: String(count),
        },
        {
          name: '_offset',
          value: String(offset),
        },
      ],
    });
    claims.push(...bundle.unbundle());
    return bundle;
  }, CLAIM_SCAN_PAGE_SIZE);
  return claims;
}

async function fetchPatientsById(billingClient: Oystehr, patientIds: string[]): Promise<Map<string, Patient>> {
  const uniqueIds = [...new Set(patientIds)].filter(Boolean);
  if (uniqueIds.length === 0) return new Map();
  const bundle = await billingClient.fhir.search<Patient>({
    resourceType: 'Patient',
    params: [
      {
        name: '_id',
        value: uniqueIds.join(','),
      },
      {
        name: '_count',
        value: String(uniqueIds.length),
      },
    ],
  });
  return new Map(bundle.unbundle().flatMap((patient) => (patient.id ? [[patient.id, patient] as const] : [])));
}

async function fetchClaimProvenances(billingClient: Oystehr, claimIds: string[]): Promise<Map<string, Provenance[]>> {
  const grouped = new Map<string, Provenance[]>();
  const batches = chunkThings([...new Set(claimIds)], PROVENANCE_BATCH);
  await Promise.all(
    batches.map((batch) =>
      fetchAllPages(async (offset, count) => {
        const bundle = await billingClient.fhir.search<Provenance>({
          resourceType: 'Provenance',
          params: [
            {
              name: 'target',
              value: batch.map((id) => `Claim/${id}`).join(','),
            },
            {
              name: '_count',
              value: String(count),
            },
            {
              name: '_offset',
              value: String(offset),
            },
          ],
        });
        for (const provenance of bundle.unbundle()) {
          for (const claimId of provenanceClaimTargetIds(provenance)) {
            const list = grouped.get(claimId) ?? [];
            list.push(provenance);
            grouped.set(claimId, list);
          }
        }
        return bundle;
      }, CLAIM_SCAN_PAGE_SIZE)
    )
  );
  return grouped;
}

function provenanceClaimTargetIds(provenance: Provenance): Set<string> {
  const ids = (provenance.target ?? [])
    .map((target) => removePrefix('Claim/', target.reference ?? ''))
    .filter((id): id is string => Boolean(id))
    .map((id) => id.split('/')[0]);
  return new Set(ids);
}
