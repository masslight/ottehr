import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  ChargeItem,
  ChargeItemDefinition,
  Claim,
  ClaimResponse,
  Condition,
  Coverage,
  Encounter,
  FhirResource,
  Location,
  Patient,
  PaymentNotice,
  Practitioner,
  Procedure,
  Resource,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AdHocBillingOutput,
  AdHocBillingRow,
  getPatientFirstName,
  getPatientLastName,
  mapGenderToLabel,
  PAYMENT_METHOD_EXTENSION_URL,
} from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { createBillingClient, CURRENT_STATUS_TAG_SYSTEM } from '../../billing/shared';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  fetchAllPages,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import {
  buildEncounterRowContext,
  fetchAppointmentReportResources,
  fetchScopedResources,
  resolveEncounterAppointment,
} from '../../shared/adhoc-report';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'adhoc-billing';

const CPT_SYSTEM = 'http://www.ama-assn.org/go/cpt';
// A Claim carries the source clinical encounter id as an identifier (set by Ottehr's own claim
// creation, not Candid) — this is how a claim joins back to its encounter.
const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');
// Dates are reported in the practice's zone (matches the client's AdHocReport formatting), not the
// server's zone — in prod the lambda runs in UTC, which would shift evening visits to the next day.
const REPORT_TIME_ZONE = 'America/New_York';
const round2 = (n: number): number => Math.round(n * 100) / 100;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { dateRange, includePayments, includeCoverage, includeCharges, includeCodes, includeClaims, secrets } =
    validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  // Two clients, one per workspace: the clinical client (_tag:not billing) sees everything the
  // clinical side writes (encounters, chart data, intake coverage, patient payments, charge
  // masters); the billing client (_tag billing) sees ONLY billing-workspace resources
  // (Claim/ClaimResponse created by the billing tool). Each fetch below must use the client for
  // the workspace its resources are actually written to, or its columns come back silently empty.
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, secrets);
  const billingOystehr = createBillingClient(m2mToken, secrets);

  // The main search stays LIGHT — only the bounded per-appointment resources ride along; each opt-in
  // billing layer's resources are pulled afterward, scoped to the encounter/patient ids (below).
  type ReportResource = Appointment | Encounter | Patient | Location | Practitioner;
  const allResources = await fetchAppointmentReportResources<ReportResource>(clinicalOystehr, {
    dateRange,
    extraParams: [{ name: '_revinclude:iterate', value: 'Encounter:part-of' }],
  });

  const encounters = allResources.filter((r): r is Encounter => r.resourceType === 'Encounter');
  const appointmentMap = new Map<string, Appointment>();
  const patientMap = new Map<string, Patient>();
  const locationMap = new Map<string, Location>();
  const practitionerMap = new Map<string, Practitioner>();
  const encounterById = new Map<string, Encounter>();

  for (const r of allResources) {
    switch (r.resourceType) {
      case 'Appointment':
        if (r.id) appointmentMap.set(`Appointment/${r.id}`, r);
        break;
      case 'Patient':
        if (r.id) patientMap.set(`Patient/${r.id}`, r);
        break;
      case 'Location':
        if (r.id) locationMap.set(`Location/${r.id}`, r);
        break;
      case 'Practitioner':
        if (r.id) practitionerMap.set(r.id, r);
        break;
      case 'Encounter':
        if (r.id) encounterById.set(r.id, r);
        break;
    }
  }

  // ---- Secondary fetches for the opt-in billing layers ---------------------------------------
  const encIds = Array.from(encounterById.keys());
  const encRefs = encIds.map((id) => `Encounter/${id}`);

  // Paginate a whole (small, global) table — used for PaymentNotice / ChargeItem / ChargeItemDefinition,
  // which number in the hundreds project-wide, so fetching all and indexing locally is cheaper and more
  // robust than a per-encounter OR-list search.
  async function fetchAll<T extends FhirResource>(
    oystehr: Oystehr,
    resourceType: T['resourceType'],
    extraParams: { name: string; value: string }[] = []
  ): Promise<T[]> {
    const out: T[] = [];
    await fetchAllPages(async (offset, count) => {
      const bundle = await oystehr.fhir.search<T>({
        resourceType,
        params: [
          { name: '_count', value: count.toString() },
          { name: '_offset', value: offset.toString() },
          ...extraParams,
        ],
      });
      out.push(...(bundle.unbundle() as T[]));
      return bundle;
    }, 1000);
    return out;
  }

  // Per-encounter layer resources are fetched via the shared scoped/paginated/chunked helper.
  const fetchScoped = <T extends FhirResource>(
    oystehr: Oystehr,
    resourceType: T['resourceType'],
    paramName: string,
    values: string[],
    extraParams: { name: string; value: string }[] = []
  ): Promise<T[]> => fetchScopedResources<T>(oystehr, resourceType, paramName, values, extraParams);

  const pushTo = <T>(map: Map<string, T[]>, key: string | undefined, item: T): void => {
    if (key) map.set(key, [...(map.get(key) ?? []), item]);
  };
  const stripRef = (ref?: string, prefix?: string): string | undefined =>
    ref ? (prefix ? ref.replace(`${prefix}/`, '') : ref.split('/')[1]) : undefined;

  const paymentsByEncId = new Map<string, PaymentNotice[]>();
  const chargesByEncId = new Map<string, ChargeItem[]>();
  const coveragesByPatId = new Map<string, Coverage[]>();
  const proceduresByEncId = new Map<string, Procedure[]>();
  const conditionById = new Map<string, Condition>();
  const cptPriceMap = new Map<string, number>(); // CPT code -> fee-schedule price (USD)
  const claimsByEncId = new Map<string, Claim[]>();
  const responsesByClaimId = new Map<string, ClaimResponse[]>();

  if (encRefs.length) {
    if (includePayments) {
      // Scope to THIS batch's encounters (PaymentNotice.request → Encounter) rather than scanning
      // every PaymentNotice project-wide on each of the ~52 concurrent 7-day batch calls — that
      // whole-table scan grows unbounded as billing history accumulates.
      // CLINICAL client: PaymentNotices are written untagged by ehr/patient-payments (which itself
      // uses the clinical client), so the billing-workspace client cannot see them.
      const notices = await fetchScoped<PaymentNotice>(clinicalOystehr, 'PaymentNotice', 'request', encRefs);
      for (const n of notices) pushTo(paymentsByEncId, stripRef(n.request?.reference, 'Encounter'), n);
    }
    if (includeCharges) {
      // Scope to this batch's encounters (ChargeItem.context → Encounter) instead of a full-table scan.
      // CLINICAL client: ChargeItems are clinical-side resources (no billing-workspace code writes
      // them; e.g. merge-patients reads them with the clinical client).
      const charges = await fetchScoped<ChargeItem>(clinicalOystehr, 'ChargeItem', 'context', encRefs);
      for (const c of charges) pushTo(chargesByEncId, stripRef(c.context?.reference, 'Encounter'), c);
      // The CPT price map comes from the charge masters (ChargeItemDefinition fee schedules), which
      // are a bounded, encounter-independent fee schedule — legitimately global, so fetchAll stays.
      // CLINICAL client: the charge masters are managed by rcm/charge-masters, which uses the
      // clinical client (the billing workspace keeps its own, separate fee-schedule CIDs).
      const defs = await fetchAll<ChargeItemDefinition>(clinicalOystehr, 'ChargeItemDefinition');
      for (const def of defs) {
        for (const group of def.propertyGroup ?? []) {
          for (const pc of group.priceComponent ?? []) {
            const cpt = pc.code?.coding?.find((c) => c.system === CPT_SYSTEM)?.code;
            const amount = pc.amount?.value;
            if (cpt && typeof amount === 'number' && !cptPriceMap.has(cpt)) cptPriceMap.set(cpt, amount);
          }
        }
      }
    }
    if (includeCoverage) {
      const patRefs = Array.from(
        new Set(encounters.map((e) => e.subject?.reference).filter((r): r is string => Boolean(r)))
      );
      // CLINICAL client: this layer reports the patient's insurance as captured at intake — those
      // Coverages are written untagged by the paperwork harvest and carry the `order` and `class`
      // (plan name) fields the row logic reads. The billing workspace holds separate Coverage
      // copies (created per-claim / via create-billing-coverage) that lack order/class and exist
      // only for patients already enrolled in the billing tool; develop's own billing code reads
      // intake coverage with the clinical client (create-billing-claim-from-encounter's
      // getClinicalResources) and only its billing-side copies with the billing client.
      const coverages = await fetchScoped<Coverage>(clinicalOystehr, 'Coverage', 'patient', patRefs, [
        { name: '_elements', value: 'status,type,payor,beneficiary,subscriberId,relationship,order,class' },
      ]);
      for (const c of coverages) pushTo(coveragesByPatId, stripRef(c.beneficiary?.reference), c);
    }
    if (includeCodes) {
      const dxIds = Array.from(
        new Set(
          encounters.flatMap((e) =>
            (e.diagnosis ?? []).map((d) => stripRef(d.condition?.reference, 'Condition')).filter(Boolean)
          )
        )
      ) as string[];
      // CLINICAL client: Conditions/Procedures are chart data written by the clinical side.
      const dxConditions = dxIds.length ? await fetchScoped<Condition>(clinicalOystehr, 'Condition', '_id', dxIds) : [];
      for (const c of dxConditions) if (c.id) conditionById.set(c.id, c);
      const procedures = await fetchScoped<Procedure>(clinicalOystehr, 'Procedure', 'encounter', encRefs);
      for (const p of procedures) pushTo(proceduresByEncId, stripRef(p.encounter?.reference, 'Encounter'), p);
    }
    if (includeClaims) {
      // Claims are few project-wide; fetch all and join to encounters by the claim-encounter-id
      // identifier the practice's claim creation stamps on each Claim.
      // BILLING client: Claims/ClaimResponses live in the billing workspace — they are created
      // billing-tagged by create-billing-claim(-from-encounter), which searches them back by the
      // same claim-encounter-id identifier with its billing client.
      const claims = await fetchAll<Claim>(billingOystehr, 'Claim');
      const inScope = new Set(encIds);
      for (const claim of claims) {
        const encId = claim.identifier?.find((i) => i.system === CLAIM_ENCOUNTER_ID_SYSTEM)?.value;
        if (encId && inScope.has(encId)) pushTo(claimsByEncId, encId, claim);
      }
      const responses = await fetchAll<ClaimResponse>(billingOystehr, 'ClaimResponse');
      for (const cr of responses) pushTo(responsesByClaimId, stripRef(cr.request?.reference, 'Claim'), cr);
    }
  }

  const hasChartTag = (resource: Resource, code: string): boolean =>
    Boolean(resource.meta?.tag?.some((tag) => tag.code === code));

  const resolveAppointment = (encounter: Encounter): Appointment | undefined =>
    resolveEncounterAppointment(encounter, appointmentMap, encounterById);

  // Pick the primary (lowest .order, else first) and secondary coverage from a patient's coverages.
  const planName = (c?: Coverage): string =>
    c?.class?.find((cl) => cl.type?.coding?.some((t) => t.code === 'plan'))?.name || c?.class?.[0]?.name || '';
  const SELF_PAY_TYPE_CODES = new Set(['pay', 'PAY', 'SELF', 'self', '81']);

  const rows: AdHocBillingRow[] = [];
  // Iterate the deduped map, not the raw filter array — a follow-up encounter revincluded via both
  // Encounter:appointment and Encounter:part-of appears twice in `encounters` and would emit two rows.
  for (const encounter of encounterById.values()) {
    const appointment = resolveAppointment(encounter);
    if (!appointment) continue;

    const {
      encounterType,
      patient,
      location,
      attendingProvider,
      visitType,
      visitStatus,
      serviceCategory,
      address,
      start,
    } = buildEncounterRowContext(encounter, appointment, { encounterById, patientMap, locationMap, practitionerMap });
    const encId = encounter.id ?? '';

    const row: AdHocBillingRow = {
      appointmentId: appointment.id || '',
      encounterId: encounter.id,
      date: start ? DateTime.fromISO(start).setZone(REPORT_TIME_ZONE).toFormat('yyyy-MM-dd') : '',
      visitType,
      serviceCategory,
      visitStatus,
      encounterType,
      patientId: patient?.id || '',
      patientName: patient ? `${getPatientFirstName(patient) || ''} ${getPatientLastName(patient) || ''}`.trim() : '',
      dateOfBirth: patient?.birthDate || null,
      sex: patient?.gender ? mapGenderToLabel[patient.gender] ?? '' : '',
      city: address?.city || '',
      state: address?.state || '',
      zip: address?.postalCode || '',
      location: location?.name || '',
      region: location?.address?.state || '',
      attendingProvider,
    };

    let paymentsCollected: number | null = null;
    if (includePayments) {
      const notices = paymentsByEncId.get(encId) ?? [];
      const total = notices.reduce((acc, n) => acc + (n.amount?.value ?? 0), 0);
      paymentsCollected = notices.length ? round2(total) : null;
      const dates = notices
        .map((n) => n.created)
        .filter((d): d is string => Boolean(d))
        .sort();
      const methods = Array.from(
        new Set(
          notices
            .map((n) => n.extension?.find((e) => e.url === PAYMENT_METHOD_EXTENSION_URL)?.valueString)
            .filter((m): m is string => Boolean(m))
        )
      );
      row.paymentsCollected = paymentsCollected;
      row.paymentCount = notices.length;
      row.paymentMethods = methods;
      row.lastPaymentDate = dates.length
        ? DateTime.fromISO(dates[dates.length - 1])
            .setZone(REPORT_TIME_ZONE)
            .toFormat('yyyy-MM-dd')
        : null;
    }

    if (includeCoverage) {
      // Only active coverage participates in primary/secondary selection — a cancelled/draft/
      // entered-in-error plan must not be reported as the payer.
      const coverages = (patient?.id ? coveragesByPatId.get(patient.id) ?? [] : [])
        .filter((c) => c.status === 'active')
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      const primary = coverages[0];
      const secondary = coverages[1];
      const primaryTypeCode = primary?.type?.coding?.[0]?.code;
      row.payerType = !primary
        ? 'Unknown'
        : primaryTypeCode && SELF_PAY_TYPE_CODES.has(primaryTypeCode)
        ? 'Self-pay'
        : 'Insured';
      row.primaryPayer = planName(primary);
      row.insuranceType = primary?.type?.coding?.[0]?.display || primaryTypeCode || '';
      row.memberId = primary?.subscriberId || '';
      row.subscriberRelationship =
        primary?.relationship?.coding?.[0]?.display || primary?.relationship?.coding?.[0]?.code || '';
      row.coverageStatus = primary?.status || '';
      row.secondaryPayer = planName(secondary);
    }

    let expectedCharge: number | null = null;
    if (includeCharges) {
      const charges = chargesByEncId.get(encId) ?? [];
      const lineCpts = charges
        .map((c) => c.code?.coding?.find((cd) => cd.system === CPT_SYSTEM)?.code)
        .filter((c): c is string => Boolean(c));
      const cpts = Array.from(new Set(lineCpts));
      // Price PER line item (two charges with the same CPT bill twice — chargeCount already counts
      // them both). When none of the line items could be priced (CPT absent from the charge
      // master), expectedCharge is null, not 0 — a 0 here would make outstandingBalance read as a
      // negative payment.
      const priced = lineCpts.map((c) => cptPriceMap.get(c)).filter((v): v is number => typeof v === 'number');
      expectedCharge = priced.length ? round2(priced.reduce((a, b) => a + b, 0)) : null;
      row.chargeCpts = cpts;
      row.chargeCount = charges.length;
      row.expectedCharge = expectedCharge;
    }

    // Outstanding balance only makes sense when BOTH charges and payments were loaded.
    if (includeCharges && includePayments) {
      row.outstandingBalance =
        expectedCharge === null && paymentsCollected === null
          ? null
          : round2((expectedCharge ?? 0) - (paymentsCollected ?? 0));
    }

    if (includeCodes) {
      const procedures = proceduresByEncId.get(encId) ?? [];
      const cptCodes: string[] = [];
      let emCode: string | undefined;
      for (const procedure of procedures) {
        const code = procedure.code?.coding?.find((c) => c.system === CPT_SYSTEM)?.code;
        if (!code) continue;
        if (hasChartTag(procedure, 'em-code')) emCode = emCode ?? code;
        else if (hasChartTag(procedure, 'cpt-code') && !cptCodes.includes(code)) cptCodes.push(code);
      }
      const icdCodes: string[] = [];
      for (const d of encounter.diagnosis ?? []) {
        const cid = stripRef(d.condition?.reference, 'Condition');
        const condition = cid ? conditionById.get(cid) : undefined;
        const icd = condition?.code?.coding?.find((c) => c.system?.includes('icd'))?.code;
        if (icd && !icdCodes.includes(icd)) icdCodes.push(icd);
      }
      row.cptCodes = cptCodes;
      row.emCode = emCode;
      row.icdCodes = icdCodes;
    }

    if (includeClaims) {
      const claims = [...(claimsByEncId.get(encId) ?? [])].sort((a, b) =>
        (b.created ?? '').localeCompare(a.created ?? '')
      );
      // Cancelled claims are dead paper — their totals must not count toward what was billed.
      const billableClaims = claims.filter((c) => c.status !== 'cancelled');
      const billed = billableClaims.reduce((acc, c) => acc + (c.total?.value ?? 0), 0);
      const hasBilled = billableClaims.some((c) => typeof c.total?.value === 'number');
      // ClaimResponse adjudication (forward-compatible — none exist until the billing tool posts them).
      const PATIENT_OWED = new Set(['copay', 'deductible', 'coins', 'coinsurance', 'patientresp']);
      let paid = 0;
      let patientResp = 0;
      let sawResponse = false;
      for (const claim of claims) {
        for (const cr of responsesByClaimId.get(claim.id ?? '') ?? []) {
          sawResponse = true;
          paid +=
            cr.payment?.amount?.value ??
            (cr.total ?? [])
              .filter((t) => t.category?.coding?.some((c) => c.code === 'benefit'))
              .reduce((a, t) => a + (t.amount?.value ?? 0), 0);
          patientResp += (cr.total ?? [])
            .filter((t) => t.category?.coding?.some((c) => c.code && PATIENT_OWED.has(c.code)))
            .reduce((a, t) => a + (t.amount?.value ?? 0), 0);
        }
      }
      const mostRecent = claims[0];
      const claimStatus = mostRecent
        ? mostRecent.meta?.tag?.find((t) => t.system === CURRENT_STATUS_TAG_SYSTEM)?.code ?? mostRecent.status ?? ''
        : '';
      const billedAmount = hasBilled ? round2(billed) : null;
      const insurancePaid = sawResponse ? round2(paid) : null;
      row.claimCount = claims.length;
      row.claimStatus = claimStatus;
      row.billedAmount = billedAmount;
      row.insurancePaid = insurancePaid;
      row.patientResponsibility = sawResponse ? round2(patientResp) : null;
      row.claimBalance = billedAmount !== null && insurancePaid !== null ? round2(billedAmount - insurancePaid) : null;
    }

    rows.push(row);
  }

  const output: AdHocBillingOutput = { rows };
  return { statusCode: 200, body: JSON.stringify(output) };
});
