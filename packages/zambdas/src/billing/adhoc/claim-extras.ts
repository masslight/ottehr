import Oystehr from '@oystehr/sdk';
import {
  Claim,
  ClaimResponse,
  Coverage,
  Location,
  Organization,
  Patient,
  PaymentReconciliation,
  Practitioner,
  Provenance,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getCoveragePlanType } from 'utils/lib/fhir/billing';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getCoding, getExtension, getNPI } from 'utils/lib/fhir/helpers';
import {
  CLAIM_ACCIDENT_STATE_EXTENSION_URL,
  CLAIM_ACCIDENT_TYPE,
  CLAIM_ACCIDENT_TYPE_EXTENSION_URLS,
  CODE_SYSTEM_CLAIM_ACCIDENT_DATE,
  CODE_SYSTEM_CLAIM_ACCIDENT_DATE_CODE,
  CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY,
  CODE_SYSTEM_CLAIM_TYPE_CODES,
} from 'utils/lib/helpers/rcm/constants';
import { AdHocBillingClaimsRow } from 'utils/lib/types/adhoc/datasets/billing-claims';
import { ERA_SOURCE } from 'utils/lib/types/data/billing/billing.constants';
import {
  CLAIM_PROVENANCE_ACTIVITY_CODES,
  CLAIM_PROVENANCE_AGENT_TYPE,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
} from 'utils/lib/types/data/billing/claim-history';
import {
  CLAIM_STATUS_FIELD_KEYS,
  CLAIM_STATUS_FIELDS,
  ClaimStatusFieldKey,
} from 'utils/lib/types/data/billing/claim-status';
import { parseStoredAcknowledgment, parseStoredTransmit } from '../claim-acknowledgments';
import { ClaimEraLinks, fetchClaimEraLinks } from '../claim-amounts';
import { ClaimLookups } from '../claim-search';
import {
  CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM,
  CODE_SYSTEM_NUBC_REVENUE,
  EXTENSION_CLAIM_ADMISSION_TYPE_CODE,
  EXTENSION_CLAIM_FACILITY_TYPE_CODE,
  EXTENSION_CLAIM_FREQUENCY_CODE,
  EXTENSION_CLAIM_PATIENT_DISCHARGE_STATUS,
  EXTENSION_CLAIM_POINT_OF_ORIGIN_CODE,
  fhirName,
  findRef,
  getClaimPcn,
  getClaimSupportingInfo,
  getClaimType,
  getEraCheckNumber,
  getEraSource,
  readClaimItemDrug,
  sortClaimInsurance,
} from '../shared';

export const BASE_EXTRA_ELEMENTS = ['Patient.meta', 'Patient.identifier', 'Patient.extension'];
export const CODES_EXTRA_ELEMENTS = ['Claim.diagnosis'];
export const TIMELINE_EXTRA_ELEMENTS = ['Claim.extension'];
export const CLAIM_DETAILS_EXTRA_ELEMENTS = [
  'Claim.extension',
  'Claim.supportingInfo',
  'Claim.billablePeriod',
  'Patient.gender',
  'Patient.address',
  'Practitioner.identifier',
  'Organization.identifier',
  'Location.identifier',
];

const COVERAGE_FETCH_BATCH = 100;

export interface ClaimExtras {
  coveragesById: Map<string, Coverage>;
  eraLinks: ClaimEraLinks;
  historyByClaimId: Map<string, Provenance[]>;
  actorNames: Map<string, string>;
  emCodes: ReadonlySet<string>;
}

export const emptyClaimExtras = (): ClaimExtras => ({
  coveragesById: new Map(),
  eraLinks: { paymentReconciliations: [], paymentReconciliationIdByClaimResponseId: new Map() },
  historyByClaimId: new Map(),
  actorNames: new Map(),
  emCodes: new Set(),
});

const instantMillis = (value: string | null | undefined): number => {
  const millis = value ? DateTime.fromISO(value).toMillis() : NaN;
  return Number.isNaN(millis) ? Number.NEGATIVE_INFINITY : millis;
};

export const compareInstants = (a: string | null | undefined, b: string | null | undefined): number => {
  const [left, right] = [instantMillis(a), instantMillis(b)];
  return left === right ? 0 : left < right ? -1 : 1;
};

const isHumanAgent = (agent: NonNullable<Provenance['agent']>[number]): boolean =>
  agent.type?.coding?.some((coding) => coding.code === CLAIM_PROVENANCE_AGENT_TYPE.human.code) ?? false;

const agentRef = (provenance: Provenance): string | undefined =>
  (provenance.agent?.find(isHumanAgent) ?? provenance.agent?.[0])?.who?.reference;

export const actorRefs = (extras: Pick<ClaimExtras, 'eraLinks' | 'historyByClaimId'>): string[] => [
  ...new Set(
    [
      ...[...extras.historyByClaimId.values()].flat().map(agentRef),
      ...(extras.eraLinks.agentRefByPaymentReconciliationId?.values() ?? []),
    ].filter((ref): ref is string => !!ref)
  ),
];

const coverageRefs = (claim: Claim): string[] =>
  sortClaimInsurance(claim)
    .map((insurance) => insurance.coverage?.reference)
    .filter((ref): ref is string => !!ref?.startsWith('Coverage/'));

export async function fetchClaimCoverages(oystehr: Oystehr, claims: Claim[]): Promise<Map<string, Coverage>> {
  const ids = [...new Set(claims.flatMap(coverageRefs).map((ref) => ref.replace('Coverage/', '')))];
  const coverages = new Map<string, Coverage>();

  for (let i = 0; i < ids.length; i += COVERAGE_FETCH_BATCH) {
    const batch = ids.slice(i, i + COVERAGE_FETCH_BATCH);

    const found = await getAllFhirSearchPages<Coverage>(
      {
        resourceType: 'Coverage',
        params: [
          { name: '_id', value: batch.join(',') },
          { name: '_elements', value: 'id,status,subscriberId,payor,relationship,type,extension' },
        ],
      },
      oystehr,
      batch.length
    );

    found.forEach((coverage) => coverage.id && coverages.set(coverage.id, coverage));
  }

  return coverages;
}

export const coveragePayorRefs = (coverages: Map<string, Coverage>): (string | undefined)[] =>
  [...coverages.values()].map((coverage) => coverage.payor?.[0]?.reference);

export async function fetchEraLinksForClaims(eraReadClient: Oystehr, lookups: ClaimLookups): Promise<ClaimEraLinks> {
  const claimResponses = [...lookups.claimResponsesByClaimId.values()].flat();
  if (claimResponses.length === 0) return emptyClaimExtras().eraLinks;
  return fetchClaimEraLinks(eraReadClient, claimResponses);
}

export const paymentIssuerRefs = (eraLinks: ClaimEraLinks): (string | undefined)[] =>
  eraLinks.paymentReconciliations.map((paymentReconciliation) => paymentReconciliation.paymentIssuer?.reference);

export async function fetchClaimHistories(oystehr: Oystehr, claimIds: string[]): Promise<Map<string, Provenance[]>> {
  const byClaimId = new Map<string, Provenance[]>();

  if (claimIds.length === 0) return byClaimId;

  const provenances = await getAllFhirSearchPages<Provenance>(
    {
      resourceType: 'Provenance',
      params: [
        { name: 'target', value: claimIds.map((id) => `Claim/${id}`).join(',') },
        { name: '_elements', value: 'id,recorded,activity,agent,target,extension' },
      ],
    },
    oystehr
  );

  const wanted = new Set(claimIds);

  for (const provenance of provenances) {
    for (const target of provenance.target ?? []) {
      const claimId = target.reference?.match(/^Claim\/(.+)$/)?.[1];
      if (!claimId || !wanted.has(claimId)) continue;
      byClaimId.set(claimId, [...(byClaimId.get(claimId) ?? []), provenance]);
    }
  }

  return byClaimId;
}

export function claimDetailsLayer(
  claim: Claim,
  lookups: ClaimLookups
): Pick<
  AdHocBillingClaimsRow,
  | 'billingProvider'
  | 'billingProviderNpi'
  | 'renderingProviderNpi'
  | 'facilityNpi'
  | 'placeOfService'
  | 'patientControlNumber'
  | 'payerClaimControlNumber'
  | 'billType'
  | 'admissionDate'
  | 'dischargeDate'
  | 'admissionType'
  | 'admissionSource'
  | 'dischargeStatus'
  | 'accidentTypes'
  | 'accidentState'
  | 'accidentDate'
  | 'attachmentCount'
  | 'patientSex'
  | 'patientState'
  | 'patientZip'
> {
  const billingProvider = findRef<Practitioner | Organization>(lookups.providers, claim.provider?.reference);

  const renderingProvider = findRef<Practitioner | Organization>(
    lookups.providers,
    claim.careTeam?.[0]?.provider?.reference
  );

  const facility = findRef<Location>(lookups.locations, claim.facility?.reference);
  const patient = findRef<Patient>(lookups.patients, claim.patient?.reference);
  const extensionString = (url: string): string => getExtension(claim, url)?.valueString ?? '';
  const facilityTypeCode = extensionString(EXTENSION_CLAIM_FACILITY_TYPE_CODE);
  const frequencyCode = extensionString(EXTENSION_CLAIM_FREQUENCY_CODE) || '1';
  const address = patient?.address?.[0];
  const institutional = getClaimType(claim) === CODE_SYSTEM_CLAIM_TYPE_CODES.institutional;

  return {
    billingProvider: billingProvider
      ? billingProvider.resourceType === 'Practitioner'
        ? fhirName(billingProvider)
        : billingProvider.name ?? ''
      : '',
    billingProviderNpi: (billingProvider && getNPI(billingProvider)) ?? '',
    renderingProviderNpi: (renderingProvider && getNPI(renderingProvider)) ?? '',
    facilityNpi: (facility && getNPI(facility)) ?? '',
    placeOfService: claim.item?.[0]?.locationCodeableConcept?.coding?.[0]?.code ?? '',
    patientControlNumber: getClaimPcn(claim) ?? '',
    payerClaimControlNumber:
      claim.identifier?.find((identifier) => identifier.system === CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM)
        ?.value ?? '',
    billType: facilityTypeCode ? `0${facilityTypeCode}${frequencyCode}` : '',
    // A professional claim's billablePeriod is the visit, not an admission.
    admissionDate: institutional ? claim.billablePeriod?.start || null : null,
    dischargeDate: institutional ? claim.billablePeriod?.end || null : null,
    admissionType: extensionString(EXTENSION_CLAIM_ADMISSION_TYPE_CODE),
    admissionSource: extensionString(EXTENSION_CLAIM_POINT_OF_ORIGIN_CODE),
    dischargeStatus: extensionString(EXTENSION_CLAIM_PATIENT_DISCHARGE_STATUS),
    accidentTypes: (Object.entries(CLAIM_ACCIDENT_TYPE_EXTENSION_URLS) as [CLAIM_ACCIDENT_TYPE, string][])
      .filter(([, url]) => getExtension(claim, url)?.valueBoolean)
      .map(([type]) => type),
    accidentState: extensionString(CLAIM_ACCIDENT_STATE_EXTENSION_URL),
    accidentDate:
      getClaimSupportingInfo(
        claim,
        CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY,
        'info',
        CODE_SYSTEM_CLAIM_ACCIDENT_DATE,
        CODE_SYSTEM_CLAIM_ACCIDENT_DATE_CODE
      )?.timingDate || null,
    attachmentCount: (claim.supportingInfo ?? []).filter(
      (info) => info.valueReference?.reference?.startsWith('DocumentReference/')
    ).length,
    patientSex: patient?.gender ?? '',
    patientState: address?.state ?? '',
    patientZip: address?.postalCode ?? '',
  };
}

export function claimLineExtras(
  claim: Claim,
  line: NonNullable<Claim['item']>[number]
): { serviceDate: string | null; placeOfService: string; revenueCode: string; ndc: string } {
  return {
    serviceDate: line.servicedPeriod?.start ?? line.servicedDate ?? claim.created ?? null,
    placeOfService: line.locationCodeableConcept?.coding?.[0]?.code ?? '',
    revenueCode: getCoding(line.revenue, CODE_SYSTEM_NUBC_REVENUE)?.code ?? '',
    ndc: readClaimItemDrug(line)?.ndc ?? '',
  };
}

export function coverageLayer(
  claim: Claim,
  coveragesById: Map<string, Coverage>,
  payersByRef: Map<string, Organization>
): Pick<
  AdHocBillingClaimsRow,
  | 'coverageCount'
  | 'primaryPlanType'
  | 'primarySubscriberRelationship'
  | 'primaryCoverageStatus'
  | 'secondaryPayerName'
  | 'secondaryMemberId'
  | 'tertiaryPayerName'
  | 'tertiaryMemberId'
> {
  const coverages = coverageRefs(claim).map((ref) => coveragesById.get(ref.replace('Coverage/', '')));
  const [primary, secondary, tertiary] = coverages;

  const payerName = (coverage?: Coverage): string => {
    const ref = coverage?.payor?.[0]?.reference;
    return (ref && payersByRef.get(ref)?.name) || coverage?.payor?.[0]?.display || '';
  };

  return {
    coverageCount: coverages.length,
    primaryPlanType: getCoveragePlanType(primary) ?? '',
    primarySubscriberRelationship:
      primary?.relationship?.coding?.[0]?.display ?? primary?.relationship?.coding?.[0]?.code ?? '',
    primaryCoverageStatus: primary?.status ?? '',
    secondaryPayerName: payerName(secondary),
    secondaryMemberId: secondary?.subscriberId ?? '',
    tertiaryPayerName: payerName(tertiary),
    tertiaryMemberId: tertiary?.subscriberId ?? '',
  };
}

export function insurancePaymentsLayer(
  claimResponses: ClaimResponse[],
  eraLinks: ClaimEraLinks,
  payersByRef: Map<string, Organization>,
  actorNames: Map<string, string>
): Pick<AdHocBillingClaimsRow, 'checkNumbers' | 'lastCheckDate' | 'insurancePayments'> {
  const byId = new Map(eraLinks.paymentReconciliations.map((era) => [era.id ?? '', era]));
  const eras = new Map<string, { era: PaymentReconciliation; claimResponse: ClaimResponse }>();

  for (const claimResponse of claimResponses) {
    const eraId = eraLinks.paymentReconciliationIdByClaimResponseId.get(claimResponse.id ?? '');
    const era = eraId ? byId.get(eraId) : undefined;

    if (era?.id && !eras.has(era.id)) eras.set(era.id, { era, claimResponse });
  }

  const insurancePayments = [...eras.values()]
    .map(({ era, claimResponse }) => {
      const issuerRef = era.paymentIssuer?.reference;
      const remitPayerRef = claimResponse.insurer?.reference;
      const payer = (issuerRef && payersByRef.get(issuerRef)) || (remitPayerRef && payersByRef.get(remitPayerRef));
      const eraSource = getEraSource(era);
      const enteredByRef = eraLinks.agentRefByPaymentReconciliationId?.get(era.id ?? '');
      return {
        checkNumber: getEraCheckNumber(era) ?? '',
        checkDate: era.paymentDate || null,
        remitDate: era.created || null,
        checkAmount: era.paymentAmount?.value ?? 0,
        payerName: (payer && payer.name) || era.paymentIssuer?.display || '',
        eraSource,
        // A clearing-house ERA is written by Oystehr, not entered by anyone.
        enteredBy: eraSource !== ERA_SOURCE.clearingHouse && enteredByRef ? actorNames.get(enteredByRef) ?? '' : '',
      };
    })
    .sort((a, b) => compareInstants(a.checkDate ?? a.remitDate, b.checkDate ?? b.remitDate));

  const checkDates = insurancePayments.map((payment) => payment.checkDate).filter((date): date is string => !!date);

  return {
    checkNumbers: [...new Set(insurancePayments.map((payment) => payment.checkNumber).filter(Boolean))],
    lastCheckDate: checkDates.sort()[checkDates.length - 1] ?? null,
    insurancePayments,
  };
}

const STATUS_CODE_BY_LABEL = new Map(
  CLAIM_STATUS_FIELDS.map((field) => [field.key, new Map(field.options.map((option) => [option.label, option.code]))])
);

const statusCode = (key: ClaimStatusFieldKey, value: unknown): string =>
  typeof value === 'string' && value ? STATUS_CODE_BY_LABEL.get(key)?.get(value) ?? value : '';

const hasActivity = (provenance: Provenance, code: string): boolean =>
  provenance.activity?.coding?.some((coding) => coding.code === code) ?? false;

const isClaimHistoryEntry = (provenance: Provenance): boolean =>
  Object.values(CLAIM_PROVENANCE_ACTIVITY_CODES).some((code) => hasActivity(provenance, code));

const byUser = (provenance: Provenance): boolean => provenance.agent?.some(isHumanAgent) ?? false;

const parseChanges = (provenance: Provenance): { field?: unknown; previousValue?: unknown; newValue?: unknown }[] => {
  const stored = provenance.extension?.find((extension) => extension.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)
    ?.valueString;
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function historyLayer(
  provenances: Provenance[],
  actorNames: Map<string, string>
): Pick<
  AdHocBillingClaimsRow,
  | 'statusChanges'
  | 'firstSubmittedDate'
  | 'lastSubmittedDate'
  | 'submissionCount'
  | 'submissions'
  | 'firstAcknowledgedDate'
  | 'acknowledgments'
  | 'noteCount'
  | 'lastNoteDate'
  | 'lastActivityDate'
  | 'userActionCount'
  | 'systemActionCount'
> {
  const nameOf = (provenance: Provenance): string => {
    const ref = agentRef(provenance);
    return (ref && actorNames.get(ref)) || '';
  };
  const entries = provenances.filter(isClaimHistoryEntry).sort((a, b) => compareInstants(a.recorded, b.recorded));

  const statusChanges = entries.flatMap((provenance) =>
    parseChanges(provenance).flatMap((change) => {
      const key = typeof change.field === 'string' ? change.field.replace(/^status\./, '') : '';
      if (change.field !== `status.${key}` || !(CLAIM_STATUS_FIELD_KEYS as readonly string[]).includes(key)) return [];
      const field = key as ClaimStatusFieldKey;
      return [
        {
          date: provenance.recorded || null,
          field,
          from: statusCode(field, change.previousValue),
          to: statusCode(field, change.newValue),
          by: byUser(provenance) ? ('user' as const) : ('system' as const),
          byName: nameOf(provenance),
        },
      ];
    })
  );

  const submissions = entries
    .filter((provenance) => hasActivity(provenance, CLAIM_PROVENANCE_ACTIVITY_CODES.submit))
    .flatMap((provenance) => {
      const stored = parseStoredTransmit(provenance);
      if (stored.kind === 'absent') return [];
      return {
        date: (stored.kind === 'parsed' ? stored.event.transmittedAt : provenance.recorded) || null,
        by: byUser(provenance) ? ('user' as const) : ('system' as const),
        byName: nameOf(provenance),
      };
    })
    .sort((a, b) => compareInstants(a.date, b.date));

  const acknowledgments = entries
    .flatMap((provenance) => {
      const stored = parseStoredAcknowledgment(provenance);
      return stored.kind === 'parsed' ? [stored.event] : [];
    })
    .map((event) => ({
      date: event.eventTime || null,
      entityKind: event.entityKind,
      entityName: event.entityName,
      message: event.message,
    }))
    .sort((a, b) => compareInstants(a.date, b.date));

  const notes = entries.filter((provenance) => hasActivity(provenance, CLAIM_PROVENANCE_ACTIVITY_CODES.note));
  const userActionCount = entries.filter(byUser).length;

  return {
    statusChanges,
    firstSubmittedDate: submissions[0]?.date ?? null,
    lastSubmittedDate: submissions[submissions.length - 1]?.date ?? null,
    submissionCount: submissions.length,
    submissions,
    firstAcknowledgedDate: acknowledgments[0]?.date ?? null,
    acknowledgments,
    noteCount: notes.length,
    lastNoteDate: notes[notes.length - 1]?.recorded || null,
    lastActivityDate: entries[entries.length - 1]?.recorded || null,
    userActionCount,
    systemActionCount: entries.length - userActionCount,
  };
}
