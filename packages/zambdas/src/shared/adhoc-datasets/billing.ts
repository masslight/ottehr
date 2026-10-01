import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  ChargeItem,
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
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getPatientFirstName, getPatientLastName, mapGenderToLabel } from 'utils/lib/fhir/patient';
import { parsePaymentRefundsFromNotice, settledRefundTotalInCents } from 'utils/lib/fhir/paymentRefunds';
import { AdHocBillingInput, AdHocBillingRow } from 'utils/lib/types/adhoc/datasets/billing';
import { PatientAccountAndCoverageResources } from 'utils/lib/types/data/account';
import {
  buildEncounterRowContext,
  fetchAppointmentReportResources,
  fetchScopedResources,
  resolveEncounterAppointment,
} from '../adhoc-report';
import { getCptModifierCodeFromProcedure } from '../candid';
import { fetchAllPages } from '../fhir';
import { composeInsuranceData } from '../pdf/sections/insuranceInfo';
import { fetchPatientAccounts } from './patient-accounts';

const CPT_SYSTEM = 'http://www.ama-assn.org/go/cpt';
const round2 = (n: number): number => Math.round(n * 100) / 100;

// The full fetch+map pipeline, separated from auth/transport so fixture tests can run it against a
// stubbed Oystehr client and assert the mapped rows parse with the endpoint's Zod schema — the same
// schema the runtime output validation uses.
// What the patient actually paid with a payment: its amount less the refunds that settled.
const netPaymentAmount = (notice: PaymentNotice): number =>
  (notice.amount?.value ?? 0) - settledRefundTotalInCents(parsePaymentRefundsFromNotice(notice)) / 100;

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
  const chargesByEncId = new Map<string, ChargeItem[]>();
  let accountsByPatient = new Map<string, PatientAccountAndCoverageResources>();
  const proceduresByEncId = new Map<string, Procedure[]>();
  const conditionById = new Map<string, Condition>();
  const cptPriceMap = new Map<string, number>(); // CPT code -> fee-schedule price (USD)

  if (encRefs.length) {
    if (includePayments) {
      // Scope to THIS batch's encounters (PaymentNotice.request → Encounter) rather than scanning
      // every PaymentNotice project-wide on each of the ~52 concurrent 7-day batch calls — that
      // whole-table scan grows unbounded as billing history accumulates.
      const notices = await fetchScoped<PaymentNotice>('PaymentNotice', 'request', encRefs);

      // A voided payment is marked cancelled (patient-payments/void); only active notices are money collected.
      for (const n of notices) {
        if (n.status !== 'active' || !n.created) continue;
        pushTo(paymentsByEncId, stripRef(n.request?.reference, 'Encounter'), n);
      }
    }
    if (includeCharges) {
      // Scope to this batch's encounters (ChargeItem.context → Encounter) instead of a full-table scan.
      const charges = await fetchScoped<ChargeItem>('ChargeItem', 'context', encRefs);
      for (const c of charges) pushTo(chargesByEncId, stripRef(c.context?.reference, 'Encounter'), c);
      // The CPT price map comes from the charge masters (ChargeItemDefinition fee schedules), which
      // are a bounded, encounter-independent fee schedule — legitimately global, so fetchAll stays.
      const defs = await fetchAll<ChargeItemDefinition>('ChargeItemDefinition');
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
      // The patient-account page's coverage picture: primary / secondary by the Account's coverage priority,
      // workers' comp kept apart on its own Account, payers resolved.
      accountsByPatient = await fetchPatientAccounts(oystehr, Array.from(patientMap.values()));
    }
    if (includeCodes) {
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
      row.paymentsCollected = paymentsCollected;
      row.paymentCount = notices.length;
      row.paymentMethods = methods;
      // RAW ISO instant of the latest payment (client-side becomes the viewer-local day).
      row.lastPaymentDate = dates.length ? dates[dates.length - 1] : null;
      // Same raw ISO instants as lastPaymentDate — one format for every date in this layer.
      row.payments = notices
        .map((n) => ({
          date: n.created,
          amount: round2(netPaymentAmount(n)),
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

        if (hasChartTag(procedure, 'em-code')) emCode = emCode ?? code;
        else if (hasChartTag(procedure, 'cpt-code') && !cptCodes.includes(code)) {
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
