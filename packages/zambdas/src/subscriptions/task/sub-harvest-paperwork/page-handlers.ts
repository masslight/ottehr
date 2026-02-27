import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  DocumentReference,
  Encounter,
  List,
  Location,
  Patient,
  Questionnaire,
  QuestionnaireResponse,
} from 'fhir/r4b';
import {
  flattenQuestionnaireAnswers,
  type HarvestStrategy,
  pageHarvestStrategy,
  Secrets,
  SELF_PAY_OPTION,
} from 'utils';
import {
  createConsentResources,
  createDocumentResources,
  createMasterRecordPatchOperations,
  createUpdatePharmacyPatchOps,
  updatePatientAccountFromQuestionnaire,
} from '../../../ehr/shared/harvest';
import { getAuth0Token } from '../../../shared';

export interface HarvestContext {
  qr: QuestionnaireResponse;
  pageLinkId: string;
  patient: Patient;
  encounter: Encounter;
  appointment: Appointment;
  location: Location | undefined;
  questionnaire: Questionnaire | undefined;
  oystehr: Oystehr;
  secrets: Secrets;
}

type HarvestStrategyHandler = (ctx: HarvestContext) => Promise<string>;

// ── Strategy implementations ────────────────────────────────────────────

const masterRecordStrategy: HarvestStrategyHandler = async (ctx) => {
  const { qr, pageLinkId, patient, questionnaire, oystehr } = ctx;
  const patientPatchOps = createMasterRecordPatchOperations(
    {
      questionnaireResponseItems: qr.item || [],
      sourceQuestionnaire: questionnaire,
      options: { filterByEnableWhen: true, includeSections: [pageLinkId] },
    },
    patient
  );

  if (patientPatchOps.patient.patchOpsForDirectUpdate.length > 0) {
    await oystehr.fhir.patch({
      resourceType: 'Patient',
      id: patient.id!,
      operations: patientPatchOps.patient.patchOpsForDirectUpdate,
    });
  }

  return `master record updated for ${pageLinkId}`;
};

const pharmacyStrategy: HarvestStrategyHandler = async (ctx) => {
  const { qr, patient, oystehr } = ctx;
  const flattenedItems = flattenQuestionnaireAnswers(qr.item ?? []);
  const pharmacyPatchOps = createUpdatePharmacyPatchOps(patient, flattenedItems);

  if (pharmacyPatchOps.length > 0) {
    await oystehr.fhir.patch({
      resourceType: 'Patient',
      id: patient.id!,
      operations: pharmacyPatchOps,
    });
  }

  return 'pharmacy updated';
};

const accountCoverageStrategy: HarvestStrategyHandler = async (ctx) => {
  const { qr, patient, questionnaire, oystehr } = ctx;

  const preserveOmittedCoverages =
    qr.item
      ?.find((item) => item.linkId === 'payment-option-page')
      ?.item?.find((subItem) => subItem.linkId === 'payment-option')?.answer?.[0]?.valueString === SELF_PAY_OPTION;

  await updatePatientAccountFromQuestionnaire(
    {
      patientId: patient.id!,
      questionnaireResponseItem: qr.item ?? [],
      preserveOmittedCoverages,
      questionnaireForEnableWhenFiltering: questionnaire,
    },
    oystehr
  );

  return 'account / coverage updated';
};

const documentsStrategy: HarvestStrategyHandler = async (ctx) => {
  const { qr, patient, appointment, oystehr } = ctx;

  // Fetch existing document references and lists for deduplication
  const docResources = (
    await oystehr.fhir.search<DocumentReference | List>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'subject', value: `Patient/${patient.id}` },
        { name: 'related', value: `Appointment/${appointment.id}` },
      ],
    })
  ).unbundle();

  const documentReferenceResources = docResources.filter(
    (r): r is DocumentReference => r.resourceType === 'DocumentReference'
  );

  // Fetch patient lists for document tracking
  const listResources = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: 'subject', value: `Patient/${patient.id}` }],
    })
  ).unbundle() as List[];

  await createDocumentResources(qr, patient.id!, appointment.id!, oystehr, listResources, documentReferenceResources);

  return 'documents created';
};

const consentStrategy: HarvestStrategyHandler = async (ctx) => {
  const { qr, patient, location, appointment, oystehr, secrets } = ctx;

  // Fetch lists for consent document tracking
  const listResources = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: 'subject', value: `Patient/${patient.id}` }],
    })
  ).unbundle() as List[];

  const oystehrAccessToken = await getAuth0Token(secrets);

  await createConsentResources({
    questionnaireResponse: qr,
    patientResource: patient,
    locationResource: location,
    appointmentId: appointment.id!,
    oystehrAccessToken,
    oystehr,
    secrets,
    listResources,
  });

  return 'consent resources created';
};

// ── Strategy registry ───────────────────────────────────────────────────

const strategyHandlers: Record<HarvestStrategy, HarvestStrategyHandler> = {
  'master-record': masterRecordStrategy,
  pharmacy: pharmacyStrategy,
  'account-coverage': accountCoverageStrategy,
  documents: documentsStrategy,
  consent: consentStrategy,
};

export const executePageHarvest = async (ctx: HarvestContext): Promise<string> => {
  const strategy = pageHarvestStrategy[ctx.pageLinkId];
  if (!strategy) {
    return `no harvest strategy registered for ${ctx.pageLinkId}, skipping`;
  }
  const handler = strategyHandlers[strategy];
  return handler(ctx);
};
