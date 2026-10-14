import Oystehr from '@oystehr/sdk';
import { Coverage, CoverageEligibilityResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  checkCoverageMatchesDetails,
  getCopayAndRemainingDeductible,
  parseCoverageEligibilityResponse,
  pullCoverageIdentifyingDetails,
} from 'utils/lib/fhir/billing';
import {
  CoverageCheckCoverageDetails,
  PATIENT_ACCOUNT_ELIGIBILITY_CHECK_COUNT,
} from 'utils/lib/types/api/patient-account';
import { InsuranceCheckStatusWithDate } from 'utils/lib/types/data/telemed/eligibility.types';
import { fetchScopedResources } from '../adhoc-report';

interface EligibilityCheckCandidate {
  id: string;
  details: CoverageCheckCoverageDetails | undefined;
}

export interface EligibilityCheckIndex {
  latestCheckId: (patientRef: string, coverage: Coverage | undefined) => string | undefined;
  load: (ids: string[]) => Promise<Map<string, InsuranceCheckStatusWithDate>>;
}

// A check carries every benefit line the payer returned (insurance[].item) and its raw reply (extensions), tens of KB
// each, so checks are read in chunks and reduced to what a report needs before the next chunk is read.
const CHECK_CHUNK_SIZE = 1000;

const chunked = <T>(items: T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / CHECK_CHUNK_SIZE) }, (_, i) =>
    items.slice(i * CHECK_CHUNK_SIZE, (i + 1) * CHECK_CHUNK_SIZE)
  );

export async function indexEligibilityChecks(oystehr: Oystehr, patientRefs: string[]): Promise<EligibilityCheckIndex> {
  const listed = await fetchScopedResources<CoverageEligibilityResponse>(
    oystehr,
    'CoverageEligibilityResponse',
    'patient',
    patientRefs,
    [{ name: '_elements', value: 'id,created,patient' }]
  );

  // As get-patient-account: only the patient's most recent checks count, whichever insurance they were for.
  const recentByPatient = new Map<string, { id: string; created: string }[]>();

  for (const cer of listed) {
    const patientRef = cer.patient?.reference;

    if (!cer.id || !cer.created || !patientRef) continue;

    recentByPatient.set(patientRef, [...(recentByPatient.get(patientRef) ?? []), { id: cer.id, created: cer.created }]);
  }

  for (const checks of recentByPatient.values()) {
    checks.sort((a, b) => DateTime.fromISO(b.created).toMillis() - DateTime.fromISO(a.created).toMillis());
    checks.splice(PATIENT_ACCOUNT_ELIGIBILITY_CHECK_COUNT);
  }

  // The insurance each check was for, read as get-patient-account reads it: the Coverage the check names, by
  // reference or contained.
  const detailsById = new Map<string, CoverageCheckCoverageDetails | undefined>();
  const coverageById = new Map<string, Coverage>();

  const recentIds = Array.from(recentByPatient.values()).flatMap((checks) => checks.map((check) => check.id));

  for (const ids of chunked(recentIds)) {
    const checks = await fetchScopedResources<CoverageEligibilityResponse>(
      oystehr,
      'CoverageEligibilityResponse',
      '_id',
      ids,
      [{ name: '_elements', value: 'id,insurance,contained' }]
    );

    const coverageRefOf = (cer: CoverageEligibilityResponse): string | undefined =>
      cer.insurance?.[0]?.coverage?.reference;

    const missingCoverageIds = Array.from(
      new Set(
        checks
          .map(coverageRefOf)
          .filter((ref): ref is string => !!ref?.startsWith('Coverage/'))
          .map((ref) => ref.replace('Coverage/', ''))
          .filter((id) => !coverageById.has(id))
      )
    );

    const coverages = await fetchScopedResources<Coverage>(oystehr, 'Coverage', '_id', missingCoverageIds, [
      { name: '_elements', value: 'id,subscriberId,payor,class' },
    ]);

    for (const coverage of coverages) if (coverage.id) coverageById.set(coverage.id, coverage);

    for (const cer of checks) {
      const ref = coverageRefOf(cer);

      if (!cer.id) continue;

      const coverage = ref
        ? coverageById.get(ref.replace('Coverage/', '')) ??
          (cer.contained ?? []).find(
            (resource): resource is Coverage => resource.resourceType === 'Coverage' && ref.includes(resource.id ?? '')
          )
        : undefined;

      detailsById.set(cer.id, coverage ? pullCoverageIdentifyingDetails(coverage) : undefined);
    }
  }

  const candidatesByPatient = new Map<string, EligibilityCheckCandidate[]>(
    Array.from(recentByPatient, ([patientRef, checks]) => [
      patientRef,
      checks.map((check) => ({ id: check.id, details: detailsById.get(check.id) })),
    ])
  );

  return {
    latestCheckId: (patientRef, coverage) =>
      coverage
        ? (candidatesByPatient.get(patientRef) ?? []).find(
            (candidate) => candidate.details && checkCoverageMatchesDetails(coverage, candidate.details)
          )?.id
        : undefined,
    load: async (ids) => {
      const results = new Map<string, InsuranceCheckStatusWithDate>();

      for (const chunk of chunked(Array.from(new Set(ids)))) {
        const checks = await fetchScopedResources<CoverageEligibilityResponse>(
          oystehr,
          'CoverageEligibilityResponse',
          '_id',
          chunk
        );

        for (const cer of checks) if (cer.id) results.set(cer.id, parseCoverageEligibilityResponse(cer));
      }

      return results;
    },
  };
}

/** A parsed check as report fields: its status and time, why it failed, and the copay / remaining deductible. */
export const eligibilityCheckFields = (
  check: InsuranceCheckStatusWithDate | undefined
): {
  status: InsuranceCheckStatusWithDate['status'] | null;
  checkedAt: string | null;
  errors: string[];
  copayAmount: number | null;
  remainingDeductible: number | null;
} => {
  const { copayAmount, remainingDeductibleAmount } = getCopayAndRemainingDeductible(check);

  return {
    status: check?.status ?? null,
    checkedAt: check?.dateISO || null,
    errors: (check?.errors ?? [])
      .map((error) => error.code?.text || error.code?.coding?.[0]?.code || '')
      .filter(Boolean),
    copayAmount: copayAmount?.amountInUSD ?? null,
    remainingDeductible: remainingDeductibleAmount?.amountInUSD ?? null,
  };
};
