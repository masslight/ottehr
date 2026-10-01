import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  ChargeItemDefinition,
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
import { getCptBillableUnitsFromCoding } from 'utils/lib/fhir/billing';
import { PAYMENT_METHOD_EXTENSION_URL, RCM_TAG_SYSTEM } from 'utils/lib/fhir/constants';
import { getPaymentVariantFromEncounter, PaymentVariant } from 'utils/lib/fhir/encounter';
import { getLocationIdFromAppointment } from 'utils/lib/fhir/helpers';
import { getPatientFirstName, getPatientLastName, mapGenderToLabel } from 'utils/lib/fhir/patient';
import { parsePaymentRefundsFromNotice, settledRefundTotalInCents } from 'utils/lib/fhir/paymentRefunds';
import { extractPayerIdFromUrl } from 'utils/lib/helpers/helpers';
import {
  buildLineItems,
  findApplicableFeeSchedule,
  findChargeMasterEntry,
  getCaseRateInfo,
  VisitPricingLineItem,
} from 'utils/lib/helpers/rcm/visit-pricing';
import { FEATURE_FLAGS_CONFIG } from 'utils/lib/ottehr-config/feature-flags';
import { AdHocBillingInput, AdHocBillingRow } from 'utils/lib/types/adhoc/datasets/billing';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { PatientAccountAndCoverageResources } from 'utils/lib/types/data/account';
import {
  buildEncounterRowContext,
  fetchAppointmentReportResources,
  fetchScopedResources,
  resolveEncounterAppointment,
} from '../adhoc-report';
import { getCptModifierCodeFromProcedure } from '../candid';
import { mapResourceToChartDataResponse } from '../chart-data';
import { fetchAllPages } from '../fhir';
import { composeInsuranceData } from '../pdf/sections/insuranceInfo';
import { fetchPatientAccounts } from './patient-accounts';

const CPT_SYSTEM = 'http://www.ama-assn.org/go/cpt';
const round2 = (n: number): number => Math.round(n * 100) / 100;

// The full fetch+map pipeline, separated from auth/transport so fixture tests can run it against a
// stubbed Oystehr client and assert the mapped rows parse with the endpoint's Zod schema — the same
// schema the runtime output validation uses.
type VisitPricingSource = NonNullable<AdHocBillingRow['pricingSource']>;

/**
 * Prices one visit the way the EHR's patient payments (PatientPaymentsList) does: the visit's payment option picks
 * the schedule — self-pay → the self-pay charge master; insurance / employer → the payer or employer fee schedule,
 * else a charge master (payer-specific, then default-insurance); not chosen yet → the default-insurance charge
 * master — and the chart's CPT / E&M codes are priced against it with the shared line-item pricing.
 */
const priceVisit = ({
  encounter,
  appointment,
  account,
  procedures,
  pricing,
}: {
  encounter: Encounter;
  appointment: Appointment | undefined;
  account: PatientAccountAndCoverageResources | undefined;
  procedures: Procedure[];
  pricing: {
    feeSchedules: ChargeItemDefinition[];
    chargeMasters: ChargeItemDefinition[];
    selfPay: ChargeItemDefinition[];
    defaultInsurance: ChargeItemDefinition[];
  };
}): {
  schedule: ChargeItemDefinition | null;
  pricingSource: VisitPricingSource | null;
  lineItems: VisitPricingLineItem[];
  expectedCharge: number | null;
} => {
  const paymentVariant = getPaymentVariantFromEncounter(encounter);
  const primaryPayerRef = account?.coverages.primary?.payor.find((p) => !!p.reference)?.reference;
  const insuranceOrgId = extractPayerIdFromUrl(primaryPayerRef) ?? primaryPayerRef?.replace('Organization/', '');

  // Employer fee schedules / charge masters are legacy-only: custom-organizations-mode employers live in the
  // billing app and carry no clinical fee-schedule associations.
  const employerOrgId =
    paymentVariant === PaymentVariant.employer && !FEATURE_FLAGS_CONFIG.customOrganizationsEnabled
      ? account?.occupationalMedicineEmployerOrganization?.id ?? account?.employerOrganization?.id
      : undefined;

  const dateOfService = appointment?.start ? appointment.start.split('T')[0] : undefined;
  const locationId = appointment ? getLocationIdFromAppointment(appointment) : undefined;

  // get-charge-master-entry prices an undated visit as of today.
  const cutoffDate = dateOfService ?? new Date().toISOString().split('T')[0];

  let schedule: ChargeItemDefinition | null = null;
  let pricingSource: VisitPricingSource | null = null;
  const isPayerVariant = paymentVariant === PaymentVariant.insurance || paymentVariant === PaymentVariant.employer;

  if (paymentVariant === PaymentVariant.selfPay) {
    schedule = findChargeMasterEntry({
      designation: 'self-pay',
      locationId,
      cutoffDate,
      orgChargeMasters: pricing.chargeMasters,
      designatedChargeMasters: pricing.selfPay,
    }).chargeMaster;

    pricingSource = schedule ? 'self-pay-charge-master' : null;
  } else if (isPayerVariant) {
    const canQueryFeeSchedule = (!!insuranceOrgId || !!employerOrgId) && !!dateOfService;

    const feeSchedule =
      canQueryFeeSchedule && dateOfService
        ? findApplicableFeeSchedule(pricing.feeSchedules, {
            payerOrganizationId: insuranceOrgId,
            dateOfService,
            locationId,
            employerOrganizationId: employerOrgId,
          })
        : null;
    if (feeSchedule) {
      schedule = feeSchedule;
      pricingSource = 'fee-schedule';
    } else {
      const chargeMasterEntry = findChargeMasterEntry({
        designation: 'default-insurance',
        payerOrganizationId: insuranceOrgId,
        employerOrganizationId: employerOrgId,
        locationId,
        cutoffDate,
        orgChargeMasters: pricing.chargeMasters,
        designatedChargeMasters: pricing.defaultInsurance,
      });
      schedule = chargeMasterEntry.chargeMaster;
      pricingSource = !schedule
        ? null
        : chargeMasterEntry.source === 'payer'
        ? 'payer-charge-master'
        : 'default-charge-master';
    }
  } else {
    schedule = findChargeMasterEntry({
      designation: 'default-insurance',
      locationId,
      cutoffDate,
      orgChargeMasters: pricing.chargeMasters,
      designatedChargeMasters: pricing.defaultInsurance,
    }).chargeMaster;

    pricingSource = schedule ? 'default-charge-master' : null;
  }

  // The chart's CPT and E&M codes, read by the chart's own mapper (as useChartData gives them to the page).
  let chart: GetChartDataResponse = { patientId: '', cptCodes: [] };

  for (const procedure of procedures) {
    chart = mapResourceToChartDataResponse(chart, procedure, encounter.id ?? '').chartDataResponse;
  }

  const lineItems = buildLineItems(schedule, chart.cptCodes, chart.emCode);

  const expectedCharge =
    schedule && lineItems.length ? round2(lineItems.reduce((sum, item) => sum + item.amount, 0)) : null;

  return { schedule, pricingSource, lineItems, expectedCharge };
};

// The refunds of a payment that settled, in USD (as the EHR's refundedAmountInCents).
const refundedAmount = (notice: PaymentNotice): number =>
  settledRefundTotalInCents(parsePaymentRefundsFromNotice(notice)) / 100;

// What the patient actually paid with a payment: its amount less the refunds that settled.
const netPaymentAmount = (notice: PaymentNotice): number => (notice.amount?.value ?? 0) - refundedAmount(notice);

export async function fetchAdHocBillingRows(oystehr: Oystehr, params: AdHocBillingInput): Promise<AdHocBillingRow[]> {
  const { dateRange, includePayments, includeCoverage, includeCharges, includeCodes } = params;

  // The main search stays LIGHT — only the bounded per-appointment resources ride along; each opt-in
  // billing layer's resources are pulled afterward, scoped to the encounter/patient ids (below).
  type ReportResource = Appointment | Encounter | Patient | Location | Practitioner;
  const allResources = await fetchAppointmentReportResources<ReportResource>(oystehr, {
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

  // Per-encounter layer resources are fetched via the shared async-bulk scoped helper.
  const fetchScoped = <T extends FhirResource>(
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
  const voidedPaymentsByEncId = new Map<string, PaymentNotice[]>();
  let accountsByPatient = new Map<string, PatientAccountAndCoverageResources>();
  const proceduresByEncId = new Map<string, Procedure[]>();
  const conditionById = new Map<string, Condition>();

  // The clinical RCM fee schedules and charge masters the EHR prices a visit with, sorted by kind.
  const pricing = {
    feeSchedules: [] as ChargeItemDefinition[],
    chargeMasters: [] as ChargeItemDefinition[],
    selfPay: [] as ChargeItemDefinition[],
    defaultInsurance: [] as ChargeItemDefinition[],
  };

  if (encRefs.length) {
    if (includePayments) {
      // Scope to THIS batch's encounters (PaymentNotice.request → Encounter) rather than scanning
      // every PaymentNotice project-wide on each of the ~52 concurrent 7-day batch calls — that
      // whole-table scan grows unbounded as billing history accumulates.
      const notices = await fetchScoped<PaymentNotice>('PaymentNotice', 'request', encRefs);

      // A voided payment is marked cancelled (patient-payments/void); only active notices are money collected.
      // The voided ones are kept apart — the EHR lists them struck out.
      for (const n of notices) {
        if (!n.created) continue;

        pushTo(
          n.status === 'active' ? paymentsByEncId : voidedPaymentsByEncId,
          stripRef(n.request?.reference, 'Encounter'),
          n
        );
      }
    }

    if (includeCharges) {
      // The same ChargeItemDefinitions find-applicable-fee-schedule and get-charge-master-entry search: a bounded,
      // encounter-independent set, so it is loaded whole and sorted by its RCM tag.
      const hasRcmTag = (cid: ChargeItemDefinition, code: string): boolean =>
        !!cid.meta?.tag?.some((t) => t.system === RCM_TAG_SYSTEM && t.code === code);
      const definitions = await fetchAll<ChargeItemDefinition>('ChargeItemDefinition', [
        {
          name: '_tag',
          value: ['fee-schedule', 'charge-master', 'self-pay', 'default-insurance']
            .map((code) => `${RCM_TAG_SYSTEM}|${code}`)
            .join(','),
        },
      ]);

      for (const cid of definitions) {
        if (hasRcmTag(cid, 'fee-schedule')) pricing.feeSchedules.push(cid);
        if (hasRcmTag(cid, 'charge-master')) pricing.chargeMasters.push(cid);
        if (hasRcmTag(cid, 'self-pay')) pricing.selfPay.push(cid);
        if (hasRcmTag(cid, 'default-insurance')) pricing.defaultInsurance.push(cid);
      }
    }
    if (includeCoverage || includeCharges) {
      // The patient-account page's coverage picture: primary / secondary by the Account's coverage priority,
      // workers' comp kept apart on its own Account, payers resolved. Charges price by its payer / employer.
      accountsByPatient = await fetchPatientAccounts(oystehr, Array.from(patientMap.values()));
    }
    if (includeCodes || includeCharges) {
      const dxIds = Array.from(
        new Set(
          encounters.flatMap((e) =>
            (e.diagnosis ?? []).map((d) => stripRef(d.condition?.reference, 'Condition')).filter(Boolean)
          )
        )
      ) as string[];

      const dxConditions = dxIds.length ? await fetchScoped<Condition>('Condition', '_id', dxIds) : [];

      for (const c of dxConditions) if (c.id) conditionById.set(c.id, c);

      const procedures = await fetchScoped<Procedure>('Procedure', 'encounter', encRefs);

      for (const p of procedures) pushTo(proceduresByEncId, stripRef(p.encounter?.reference, 'Encounter'), p);
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
      // RAW ISO instant — the server never zone-formats dates; the client dataset rewrites this
      // to the viewer-local yyyy-MM-dd day in the browser.
      date: start || '',
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
      const total = notices.reduce((acc, n) => acc + netPaymentAmount(n), 0);
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

      const voided = voidedPaymentsByEncId.get(encId) ?? [];
      row.paymentsCollected = paymentsCollected;
      row.paymentCount = notices.length;
      row.paymentMethods = methods;
      row.refundedTotal = round2(notices.reduce((acc, n) => acc + refundedAmount(n), 0));
      row.voidedPaymentCount = voided.length;
      row.voidedPaymentsTotal = round2(voided.reduce((acc, n) => acc + (n.amount?.value ?? 0), 0));

      // RAW ISO instant of the latest payment (client-side becomes the viewer-local day).
      row.lastPaymentDate = dates.length ? dates[dates.length - 1] : null;

      // Same raw ISO instants as lastPaymentDate — one format for every date in this layer.
      row.payments = notices
        .map((n) => ({
          date: n.created,
          amount: round2(netPaymentAmount(n)),
          refundedAmount: round2(refundedAmount(n)),
          method: n.extension?.find((e) => e.url === PAYMENT_METHOD_EXTENSION_URL)?.valueString ?? '',
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    if (includeCoverage) {
      const account = patient?.id ? accountsByPatient.get(`Patient/${patient.id}`) : undefined;
      const { primary, secondary } = account?.coverages ?? {};

      // The face sheet's insurance composer: carrier from the resolved payer, member id from the MB identifier.
      const insurance = composeInsuranceData({
        coverages: account?.coverages ?? {},
        insuranceOrgs: account?.insuranceOrgs ?? [],
      });

      const primaryTypeCode = primary?.type?.coding?.[0]?.code;

      row.payerType = !primary
        ? 'Unknown'
        : primaryTypeCode && SELF_PAY_TYPE_CODES.has(primaryTypeCode)
        ? 'Self-pay'
        : 'Insured';

      row.primaryPayer = insurance.primary.insuranceCarrier || planName(primary);
      row.insuranceType = primary?.type?.coding?.[0]?.display || primaryTypeCode || '';
      row.memberId = insurance.primary.memberId || primary?.subscriberId || '';
      row.subscriberRelationship =
        primary?.relationship?.coding?.[0]?.display || primary?.relationship?.coding?.[0]?.code || '';
      row.coverageStatus = primary?.status || '';
      row.secondaryPayer = insurance.secondary.insuranceCarrier || planName(secondary);
    }

    let expectedCharge: number | null = null;

    if (includeCharges) {
      // An annotation follow-up is a note on its parent visit: the payment option that prices it lives on the
      // parent Encounter (the payments panel is the visit's), so the parent decides the schedule.
      const parentEncounter = encounter.partOf?.reference
        ? encounterById.get(encounter.partOf.reference.replace('Encounter/', ''))
        : undefined;

      const pricingResult = priceVisit({
        encounter: encounterType === 'follow-up' && parentEncounter ? parentEncounter : encounter,
        appointment,
        account: patient?.id ? accountsByPatient.get(`Patient/${patient.id}`) : undefined,
        procedures: proceduresByEncId.get(encId) ?? [],
        pricing,
      });

      expectedCharge = pricingResult.expectedCharge;
      row.chargeCpts = Array.from(new Set(pricingResult.lineItems.map((item) => item.code)));
      row.chargeCount = pricingResult.lineItems.length;
      row.expectedCharge = expectedCharge;
      row.pricingSource = pricingResult.pricingSource;
      row.pricingScheduleName = pricingResult.schedule?.title ?? '';
      row.caseRate = getCaseRateInfo(pricingResult.schedule)?.amount ?? null;
      row.unpricedCpts = pricingResult.lineItems.filter((item) => item.feeUnknown).map((item) => item.code);
    }

    // Outstanding balance only makes sense when BOTH charges and payments were loaded.
    if (includeCharges && includePayments) {
      // Without a priced charge there is nothing to owe against: a payment alone is not a negative balance.
      row.outstandingBalance = expectedCharge === null ? null : round2(expectedCharge - (paymentsCollected ?? 0));
    }

    if (includeCodes) {
      const procedures = proceduresByEncId.get(encId) ?? [];
      const cptCodes: string[] = [];
      const cptModifiers: string[] = [];
      const cptBillableUnits: number[] = [];
      let emCode: string | undefined;

      for (const procedure of procedures) {
        const coding = procedure.code?.coding?.find((c) => c.system === CPT_SYSTEM);
        const code = coding?.code;

        if (!code) continue;

        if (hasChartTag(procedure, 'em-code')) {
          emCode = emCode ?? code;
        } else if (hasChartTag(procedure, 'cpt-code')) {
          // One entry per charted CPT line, as the chart lists them — the same code can be charted twice with
          // different modifiers / units, and cptModifiers / cptBillableUnits run parallel to this array.
          cptCodes.push(code);
          // Modifiers and units as the chart's CPT DTO (makeCPTCodeDTO) and the claim read them.
          cptModifiers.push((getCptModifierCodeFromProcedure(procedure) ?? []).map((m) => m.code).join(','));
          cptBillableUnits.push(getCptBillableUnitsFromCoding(coding) ?? 1);
        }
      }

      const icdCodes: string[] = [];

      // Primary (rank 1) first, as the chart and the claim order the diagnoses.
      const diagnoses = [...(encounter.diagnosis ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

      for (const d of diagnoses) {
        const cid = stripRef(d.condition?.reference, 'Condition');
        const condition = cid ? conditionById.get(cid) : undefined;
        const icd = condition?.code?.coding?.find((c) => c.system?.includes('icd'))?.code;

        if (icd && !icdCodes.includes(icd)) icdCodes.push(icd);
      }
      row.cptCodes = cptCodes;
      row.cptModifiers = cptModifiers;
      row.cptBillableUnits = cptBillableUnits;
      row.emCode = emCode ?? '';
      row.icdCodes = icdCodes;
    }

    rows.push(row);
  }

  return rows;
}
