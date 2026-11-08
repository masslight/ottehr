import Oystehr from '@oystehr/sdk';
import {
  ActivityDefinition,
  Condition,
  DiagnosticReport,
  FhirResource,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Observation,
  ObservationDefinition,
  Patient,
  Quantity,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
  ServiceRequest,
} from 'fhir/r4b';
import { ERX_MEDICATION_META_TAG_CODE, QR_DISTRIBUTION_TAG } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  getDosageUnitsAndRouteOfMedication,
  getMedicationFromMA,
  getMedicationName,
  mapFhirToOrderStatus,
} from 'utils/lib/fhir/medication-administration';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { LOINC_SYSTEM } from 'utils/lib/fhir/vitals';
import { isInHouseLabServiceRequest } from 'utils/lib/helpers/in-house-labs';
import { getCalculatedItemDefs } from 'utils/lib/helpers/paperwork/calculated-answers';
import {
  ProviderChartDataFieldsNames,
  VitalAlertCriticality,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import {
  FlowsheetDiagnosis,
  FlowsheetForm,
  FlowsheetLabResult,
  FlowsheetMedication,
  FlowsheetProblem,
  PatientDiagnoses,
  PatientMedications,
} from 'utils/lib/types/api/flowsheets.types';
import { MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE } from 'utils/lib/types/api/medication-administration.constants';
import {
  ABNORMAL_RESULT_DR_TAG,
  IN_HOUSE_OBS_DEF_ID_SYSTEM,
  IN_HOUSE_TEST_CODE_SYSTEM,
} from 'utils/lib/types/data/in-house/in-house.constants';
import { OYSTEHR_LAB_OI_CODE_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { makeConditionDTO, makeMedicationDTO, makePrescribedMedicationDTO } from '../../shared/chart-data';
import { getStandaloneForms, makeQuestionnaireLoader } from '../../shared/practice-forms';
import { fetchVisits, fetchVitals, VisitResources } from './helpers';

// The per-patient data layer flowsheets are built on: one fetch + pure shaping function per kind of chart data,
// each keyed by encounter id so a flowsheet can turn it into visit columns. Every query is built here from the
// patient id and from ids on resources already fetched.

export type FlowsheetDataKind = 'birthDate' | 'vitals' | 'diagnoses' | 'medications' | 'forms' | 'labs';

export interface FlowsheetData extends VisitResources {
  // The 'birthDate' kind: the patient's birth date and sex, for age-based references.
  birthDate?: string;
  gender?: Patient['gender'];
  vitals?: Observation[];
  diagnoses?: PatientDiagnoses;
  medications?: PatientMedications;
  forms?: Record<string, FlowsheetForm[]>;
  labs?: Record<string, FlowsheetLabResult[]>;
}

/** The patient's visits plus only the kinds the flowsheet declared, fetched in parallel. */
export const fetchFlowsheetData = async (
  oystehr: Oystehr,
  patientId: string,
  kinds: FlowsheetDataKind[]
): Promise<FlowsheetData> => {
  const wanted = <T>(kind: FlowsheetDataKind, fetch: () => Promise<T>): Promise<T | undefined> =>
    kinds.includes(kind) ? fetch() : Promise.resolve(undefined);
  const [visits, demographics, vitals, problemList, medications, forms, labs] = await Promise.all([
    fetchVisits(oystehr, patientId),
    wanted('birthDate', () => fetchDemographics(oystehr, patientId)),
    wanted('vitals', () => fetchVitals(oystehr, patientId)),
    wanted('diagnoses', () => fetchProblemList(oystehr, patientId)),
    wanted('medications', () => fetchMedications(oystehr, patientId)),
    wanted('forms', () => fetchForms(oystehr, patientId)),
    wanted('labs', () => fetchLabResults(oystehr, patientId)),
  ]);
  return {
    ...visits,
    birthDate: demographics?.birthDate,
    gender: demographics?.gender,
    vitals,
    diagnoses: problemList && { byEncounter: buildVisitDiagnoses(visits), problemList },
    medications,
    forms,
    labs,
  };
};

const pushTo = <T>(groups: Record<string, T[]>, encounterId: string | undefined, item: T): void => {
  if (!encounterId) return;
  groups[encounterId] = [...(groups[encounterId] ?? []), item];
};

const search = <T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  params: { name: string; value: string }[]
): Promise<T[]> => getAllFhirSearchPages<T>({ resourceType, params }, oystehr);

const fetchDemographics = async (
  oystehr: Oystehr,
  patientId: string
): Promise<Pick<Patient, 'birthDate' | 'gender'>> => {
  const patients = await search<Patient>(oystehr, 'Patient', [
    { name: '_id', value: patientId },
    { name: '_elements', value: 'birthDate,gender' },
  ]);
  return { birthDate: patients[0]?.birthDate, gender: patients[0]?.gender };
};

// ---- Diagnoses + problem list ------------------------------------------------------------------------------

/** Each visit's charted diagnoses (from the visit resources already fetched), primary first. */
export const buildVisitDiagnoses = ({
  encounters,
  conditions,
}: Pick<VisitResources, 'encounters' | 'conditions'>): Record<string, FlowsheetDiagnosis[]> => {
  const byEncounter: Record<string, FlowsheetDiagnosis[]> = {};
  encounters.forEach((encounter) => {
    const diagnoses = encounter.diagnosis ?? [];
    if (!encounter.id || diagnoses.length === 0) return;
    // Rank 1 is the primary diagnosis; without one the first charted is (as the visit header does).
    const primaryIndex = Math.max(
      0,
      diagnoses.findIndex((d) => d.rank === 1)
    );
    const ordered = [diagnoses[primaryIndex], ...diagnoses.filter((_, i) => i !== primaryIndex)];
    const resolved = ordered.flatMap((d) => {
      const condition = conditions.find((c) => c.id === getIdFromReference(d.condition.reference, 'Condition'));
      const coding = condition?.code?.coding?.[0];
      return coding?.code ? [{ code: coding.code, display: coding.display ?? condition?.code?.text ?? '' }] : [];
    });
    // The primary is the first one whose Condition exists, so a dangling reference never leaves a visit without one.
    resolved.forEach((diagnosis, i) => pushTo(byEncounter, encounter.id, { ...diagnosis, primary: i === 0 }));
  });
  return byEncounter;
};

const MEDICAL_CONDITION_TAG: ProviderChartDataFieldsNames = 'medical-condition';

const fetchProblemList = async (oystehr: Oystehr, patientId: string): Promise<FlowsheetProblem[]> =>
  buildProblemList(
    await search<Condition>(oystehr, 'Condition', [
      { name: 'subject', value: `Patient/${patientId}` },
      { name: '_tag', value: MEDICAL_CONDITION_TAG },
    ])
  );

/** The Medical Conditions page's entries with their status. */
export const buildProblemList = (conditions: Condition[]): FlowsheetProblem[] =>
  conditions
    .filter((c) => c.verificationStatus?.coding?.[0]?.code !== 'entered-in-error')
    .flatMap((c) => {
      const dto = makeConditionDTO(c);
      return dto.code
        ? [{ code: dto.code, display: dto.display ?? '', status: dto.current ? 'active' : 'inactive' }]
        : [];
    });

// ---- Medications ---------------------------------------------------------------------------------------------

export interface MedicationResources {
  /** eRx prescriptions. */
  requests: MedicationRequest[];
  /** In-house medication orders. */
  administrations: MedicationAdministration[];
  /** Medication-list entries plus the statements written when an in-house order was given. */
  statements: MedicationStatement[];
}

const LIST_ENTRY_TAGS: ProviderChartDataFieldsNames[] = ['current-medication', 'prescribed-medication'];

const fetchMedications = async (oystehr: Oystehr, patientId: string): Promise<PatientMedications> => {
  const patient = `Patient/${patientId}`;
  const [requests, orderResources, listStatements] = await Promise.all([
    search<MedicationRequest>(oystehr, 'MedicationRequest', [
      { name: 'patient', value: patient },
      { name: '_tag', value: ERX_MEDICATION_META_TAG_CODE },
    ]),
    search<MedicationAdministration | MedicationStatement>(oystehr, 'MedicationAdministration', [
      { name: 'subject', value: patient },
      { name: '_tag', value: MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE },
      { name: '_revinclude', value: 'MedicationStatement:part-of' },
    ]),
    search<MedicationStatement>(oystehr, 'MedicationStatement', [
      { name: 'subject', value: patient },
      { name: '_tag', value: LIST_ENTRY_TAGS.join(',') },
    ]),
  ]);
  return buildMedications({
    requests,
    administrations: orderResources.filter(
      (r): r is MedicationAdministration => r.resourceType === 'MedicationAdministration'
    ),
    statements: [
      ...orderResources.filter((r): r is MedicationStatement => r.resourceType === 'MedicationStatement'),
      ...listStatements,
    ],
  });
};

export const buildMedications = ({
  requests,
  administrations,
  statements,
}: MedicationResources): PatientMedications => {
  const byEncounter: Record<string, FlowsheetMedication[]> = {};
  const live = statements.filter((s) => s.status !== 'entered-in-error');

  requests.forEach((req) => {
    if (req.status === 'entered-in-error') return;
    const name = makePrescribedMedicationDTO(req).name ?? req.medicationCodeableConcept?.text;
    if (!name) return;
    pushTo(byEncounter, getIdFromReference(req.encounter?.reference, 'Encounter'), {
      name,
      source: 'eRx',
      status: req.status,
      time: req.authoredOn ?? req.meta?.lastUpdated,
    });
  });

  // The instant a drug was given is on the MedicationStatement written at administration (partOf -> the order).
  const givenAt = new Map<string, string>();
  live.forEach((s) => {
    const orderId = s.partOf?.map((r) => getIdFromReference(r.reference, 'MedicationAdministration')).find(Boolean);
    if (orderId && s.effectiveDateTime) givenAt.set(orderId, s.effectiveDateTime);
  });
  administrations.forEach((ma) => {
    if (ma.status === 'entered-in-error') return;
    const medication = getMedicationFromMA(ma);
    const concept = ma.medicationCodeableConcept;
    const name = getMedicationName(medication) ?? concept?.coding?.[0]?.display ?? concept?.text;
    if (!name) return;
    const { dose, units } = getDosageUnitsAndRouteOfMedication(ma);
    pushTo(byEncounter, getIdFromReference(ma.context?.reference, 'Encounter'), {
      name,
      source: 'in-house',
      status: mapFhirToOrderStatus(ma) ?? 'pending',
      dose: dose === undefined ? undefined : [dose, units].filter(Boolean).join(' '),
      time: givenAt.get(ma.id ?? '') ?? ma.effectiveDateTime,
    });
  });

  const medicationList = live
    .filter((s) => s.meta?.tag?.some((t) => LIST_ENTRY_TAGS.some((tag) => tag === t.code)))
    .map(makeMedicationDTO)
    .filter((dto) => dto.name)
    .map((dto) => ({
      name: dto.name,
      status: dto.status,
      dose: dto.intakeInfo.dose ?? '',
      source: dto.type === 'prescribed-medication' ? ('prescribed' as const) : ('patient-reported' as const),
    }));

  return { byEncounter, medicationList };
};

// ---- Practice forms ------------------------------------------------------------------------------------------

const fetchForms = async (oystehr: Oystehr, patientId: string): Promise<Record<string, FlowsheetForm[]>> => {
  const responses = await search<QuestionnaireResponse>(oystehr, 'QuestionnaireResponse', [
    { name: 'subject', value: `Patient/${patientId}` },
    { name: '_tag', value: `${QR_DISTRIBUTION_TAG.system}|${QR_DISTRIBUTION_TAG.code}` },
    { name: 'status', value: 'completed,amended' },
  ]);
  return buildForms(await getStandaloneForms(responses, makeQuestionnaireLoader(oystehr)));
};

const calculatedValue = (answer: QuestionnaireResponseItemAnswer | undefined): number | string | boolean | undefined =>
  answer?.valueInteger ?? answer?.valueDecimal ?? answer?.valueBoolean ?? answer?.valueString;

/** Completed forms by visit, each with the values the form computed itself; nothing is scored here. */
export const buildForms = (forms: StandaloneFormDTO[]): Record<string, FlowsheetForm[]> => {
  const byEncounter: Record<string, FlowsheetForm[]> = {};
  forms.forEach((form) => {
    const qr = form.questionnaireResponse;
    if (qr.status !== 'completed' && qr.status !== 'amended') return;

    const answers = new Map<string, QuestionnaireResponseItemAnswer>();
    const walk = (items: QuestionnaireResponseItem[]): void =>
      items.forEach((item) => {
        if (item.answer?.[0]) answers.set(item.linkId, item.answer[0]);
        walk([...(item.item ?? []), ...(item.answer ?? []).flatMap((answer) => answer.item ?? [])]);
      });
    walk(qr.item ?? []);

    const results = getCalculatedItemDefs(form.allItems).flatMap(({ linkId, item }) => {
      const value = calculatedValue(answers.get(linkId));
      return value === undefined ? [] : [{ linkId, label: item.text ?? linkId, value }];
    });
    pushTo(byEncounter, getIdFromReference(qr.encounter?.reference, 'Encounter'), {
      name: form.questionnaireTitle,
      status: qr.status,
      completedAt: qr.authored ?? qr.meta?.lastUpdated,
      results,
    });
  });
  return byEncounter;
};

// ---- Lab results ---------------------------------------------------------------------------------------------

export interface LabResources {
  serviceRequests: ServiceRequest[];
  reports: DiagnosticReport[];
  observations: Observation[];
  /** The in-house tests' definitions, whose ObservationDefinitions name the analytes. */
  activityDefinitions: ActivityDefinition[];
}

const fetchLabResults = async (oystehr: Oystehr, patientId: string): Promise<Record<string, FlowsheetLabResult[]>> => {
  const orders = (codeSystem: string): Promise<(ServiceRequest | DiagnosticReport | Observation)[]> =>
    search<ServiceRequest | DiagnosticReport | Observation>(oystehr, 'ServiceRequest', [
      { name: 'subject', value: `Patient/${patientId}` },
      { name: 'code', value: `${codeSystem}|` },
      { name: 'status:not', value: 'revoked,entered-in-error' },
      { name: '_revinclude', value: 'DiagnosticReport:based-on' },
      { name: '_include:iterate', value: 'DiagnosticReport:result' },
    ]);
  const resources = (await Promise.all([orders(IN_HOUSE_TEST_CODE_SYSTEM), orders(OYSTEHR_LAB_OI_CODE_SYSTEM)])).flat();
  const serviceRequests = resources.filter((r): r is ServiceRequest => r.resourceType === 'ServiceRequest');

  const canonicals = new Set(
    serviceRequests.filter(isInHouseLabServiceRequest).flatMap((sr) => sr.instantiatesCanonical ?? [])
  );
  const activityDefinitions = (
    await Promise.all(
      [...canonicals].map((canonical) => {
        const [url, version] = canonical.split('|');
        return search<ActivityDefinition>(oystehr, 'ActivityDefinition', [
          { name: 'url', value: url },
          ...(version ? [{ name: 'version', value: version }] : []),
        ]);
      })
    )
  ).flat();

  return buildLabResults({
    serviceRequests,
    reports: resources.filter((r): r is DiagnosticReport => r.resourceType === 'DiagnosticReport'),
    observations: resources.filter((r): r is Observation => r.resourceType === 'Observation'),
    activityDefinitions,
  });
};

/** The grid flag for a saved v3 ObservationInterpretation code; nothing is derived from the value itself. */
export const labFlagOf = (interpretation: string): VitalAlertCriticality | undefined => {
  switch (interpretation.toUpperCase()) {
    case 'HH':
    case 'LL':
    case 'AA':
    case 'CRITICAL':
      return VitalAlertCriticality.Critical;
    case 'H':
    case 'L':
    case 'A':
    case 'HX':
    case 'LX':
    case 'ABNORMAL':
      return VitalAlertCriticality.Abnormal;
    default:
      return undefined;
  }
};

const rangeText = (range: { text?: string; low?: Quantity; high?: Quantity } | undefined): string => {
  if (range?.text) return range.text;
  const low = range?.low?.value;
  const high = range?.high?.value;
  if (low !== undefined && high !== undefined) return `${low}-${high}`;
  if (low !== undefined) return `>=${low}`;
  if (high !== undefined) return `<=${high}`;
  return '';
};

export const buildLabResults = ({
  serviceRequests,
  reports,
  observations,
  activityDefinitions,
}: LabResources): Record<string, FlowsheetLabResult[]> => {
  const byEncounter: Record<string, FlowsheetLabResult[]> = {};
  reports.forEach((report) => {
    if (report.status === 'entered-in-error' || report.status === 'cancelled') return;
    const orderId = report.basedOn
      ?.map((r) => getIdFromReference(r.reference, 'ServiceRequest'))
      .find((id): id is string => !!id);
    const order = serviceRequests.find((sr) => sr.id === orderId);
    const encounterId = getIdFromReference(order?.encounter?.reference ?? report.encounter?.reference, 'Encounter');
    if (!encounterId) return;

    const isInHouse = !!order && isInHouseLabServiceRequest(order);
    const definition = isInHouse
      ? activityDefinitions.find((ad) => `${ad.url}|${ad.version}` === order.instantiatesCanonical?.[0])
      : undefined;
    const observationDefinitions = (definition?.contained ?? []).filter(
      (c): c is ObservationDefinition => c.resourceType === 'ObservationDefinition'
    );
    const testName = order?.code?.text ?? report.code?.text ?? '';
    const reportAbnormal = report.meta?.tag?.some(
      (t) => t.system === ABNORMAL_RESULT_DR_TAG.system && t.code === ABNORMAL_RESULT_DR_TAG.code
    );

    (report.result ?? []).forEach((ref) => {
      const obs = observations.find((o) => o.id === getIdFromReference(ref.reference, 'Observation'));
      if (!obs || obs.status === 'entered-in-error' || obs.status === 'cancelled') return;
      // An in-house result names its analyte through the test definition's ObservationDefinition.
      const defId = obs.extension?.find((e) => e.url === IN_HOUSE_OBS_DEF_ID_SYSTEM)?.valueString?.replace(/^#/, '');
      const obsDef =
        observationDefinitions.find((d) => d.id === defId) ??
        (observationDefinitions.length === 1 ? observationDefinitions[0] : undefined);
      const code = isInHouse ? obsDef?.code : obs.code;
      const value = obs.valueQuantity?.value;
      const coded = obs.valueCodeableConcept;
      // The in-house flag lives on the result Observation; older results only carry it as a tag on the report.
      const interpretation = obs.interpretation?.[0]?.coding?.[0]?.code ?? (reportAbnormal ? 'A' : '');
      pushTo(byEncounter, encounterId, {
        analyte: code?.text ?? code?.coding?.find((c) => c.display)?.display ?? testName,
        loincCodes: (code?.coding ?? []).flatMap((c) => (c.system === LOINC_SYSTEM && c.code ? [c.code] : [])),
        value,
        valueText:
          value !== undefined
            ? String(value)
            : obs.valueString ?? coded?.text ?? coded?.coding?.[0]?.display ?? coded?.coding?.[0]?.code ?? '',
        unit:
          obs.valueQuantity?.unit ??
          obs.valueQuantity?.code ??
          obsDef?.quantitativeDetails?.unit?.coding?.[0]?.code ??
          '',
        referenceRange: rangeText(obs.referenceRange?.[0] ?? obsDef?.qualifiedInterval?.[0]?.range),
        interpretation,
        flag: labFlagOf(interpretation),
        resultedAt: obs.effectiveDateTime ?? obs.issued ?? report.effectiveDateTime ?? report.issued,
        source: isInHouse ? 'in-house' : 'external',
      });
    });
  });
  return byEncounter;
};
