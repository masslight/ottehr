import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
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
  getRelatedPersonForPatient,
  type HarvestStrategy,
  INSURANCE_PAY_OPTION,
  OCC_MED_SELF_PAY_OPTION,
  pageHarvestStrategy,
  PaymentVariant,
  Secrets,
  SELF_PAY_OPTION,
  updateEncounterPaymentVariantExtension,
} from 'utils';
import {
  createConsentResources,
  createDocumentResources,
  createErxContactOperation,
  createMasterRecordPatchOperations,
  createUpdatePharmacyPatchOps,
  getAccountAndCoverageResourcesForPatient,
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
  const { qr, patient, encounter, questionnaire, oystehr } = ctx;

  const paymentOption = qr.item
    ?.find((item) => item.linkId === 'payment-option-page')
    ?.item?.find((subItem) => subItem.linkId === 'payment-option')?.answer?.[0]?.valueString;

  const occMedPaymentOption = qr.item
    ?.find((item) => item.linkId === 'payment-option-occ-med-page')
    ?.item?.find((subItem) => subItem.linkId === 'payment-option-occupational')?.answer?.[0]?.valueString;

  const preserveOmittedCoverages = paymentOption === SELF_PAY_OPTION || occMedPaymentOption === OCC_MED_SELF_PAY_OPTION;

  await updatePatientAccountFromQuestionnaire(
    {
      patientId: patient.id!,
      questionnaireResponseItem: qr.item ?? [],
      preserveOmittedCoverages,
      questionnaireForEnableWhenFiltering: questionnaire,
    },
    oystehr
  );

  // Update encounter payment variant and account references
  const selectedPaymentOption = paymentOption ?? occMedPaymentOption;
  let paymentVariant: PaymentVariant = PaymentVariant.selfPay;
  if (selectedPaymentOption === INSURANCE_PAY_OPTION) {
    paymentVariant = PaymentVariant.insurance;
  }
  if (selectedPaymentOption === 'Employer') {
    paymentVariant = PaymentVariant.employer;
  }

  const updatedEncounter = updateEncounterPaymentVariantExtension(encounter, paymentVariant);
  const encounterPatchOperations: Operation[] = [
    {
      op: encounter.extension !== undefined ? 'replace' : 'add',
      path: '/extension',
      value: updatedEncounter.extension,
    },
  ];

  const { account: latestAccount, workersCompAccount } = await getAccountAndCoverageResourcesForPatient(
    patient.id!,
    oystehr
  );

  const patientAccountReference = latestAccount?.id ? `Account/${latestAccount.id}` : undefined;
  const workersCompAccountReference = workersCompAccount?.id ? `Account/${workersCompAccount.id}` : undefined;
  const { accounts: updatedEncounterAccounts, changed: accountsChanged } = mergeEncounterAccounts(encounter.account, [
    patientAccountReference,
    workersCompAccountReference,
  ]);

  if (accountsChanged && updatedEncounterAccounts) {
    encounterPatchOperations.push({
      op: encounter.account ? 'replace' : 'add',
      path: '/account',
      value: updatedEncounterAccounts,
    });
  }

  if (encounterPatchOperations.length) {
    await oystehr.fhir.patch<Encounter>({
      id: encounter.id!,
      resourceType: 'Encounter',
      operations: encounterPatchOperations,
    });
  }

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

const erxContactStrategy: HarvestStrategyHandler = async (ctx) => {
  const { patient, oystehr } = ctx;

  const relatedPerson = await getRelatedPersonForPatient(patient.id!, oystehr);
  if (!relatedPerson || !relatedPerson.id) {
    console.log(`No RelatedPerson found for patient ${patient.id}, skipping erx-contact harvest`);
    return 'erx-contact skipped (no RelatedPerson)';
  }

  const erxContactOp = createErxContactOperation(relatedPerson, patient);
  if (erxContactOp) {
    await oystehr.fhir.patch({
      resourceType: 'Patient',
      id: patient.id!,
      operations: [erxContactOp],
    });
  }

  return 'erx-contact updated';
};

// ── Strategy registry ───────────────────────────────────────────────────

export const strategyHandlers: Record<HarvestStrategy, HarvestStrategyHandler> = {
  'master-record': masterRecordStrategy,
  pharmacy: pharmacyStrategy,
  'account-coverage': accountCoverageStrategy,
  documents: documentsStrategy,
  consent: consentStrategy,
  'erx-contact': erxContactStrategy,
};

export const mergeEncounterAccounts = (
  existingAccounts: Encounter['account'],
  references: (string | undefined)[]
): { accounts?: Encounter['account']; changed: boolean } => {
  const sanitizedReferences = references.filter((reference): reference is string => Boolean(reference));
  if (!sanitizedReferences.length) {
    return { accounts: existingAccounts, changed: false };
  }

  const normalizedAccounts: Encounter['account'] = existingAccounts ? [...existingAccounts] : [];
  const existingRefSet = new Set(
    (existingAccounts ?? [])
      .map((account) => account.reference)
      .filter((reference): reference is string => Boolean(reference))
  );
  let changed = false;

  sanitizedReferences.forEach((reference) => {
    if (!existingRefSet.has(reference)) {
      normalizedAccounts.push({ reference });
      existingRefSet.add(reference);
      changed = true;
    }
  });

  return {
    accounts: changed ? normalizedAccounts : existingAccounts,
    changed,
  };
};

export const executePageHarvest = async (ctx: HarvestContext): Promise<string> => {
  const strategies = pageHarvestStrategy[ctx.pageLinkId];
  if (!strategies || strategies.length === 0) {
    return `no harvest strategy registered for ${ctx.pageLinkId}, skipping`;
  }
  const results = [];
  for (const strategy of strategies) {
    const handler = strategyHandlers[strategy];
    results.push(await handler(ctx));
  }
  return results.join(', ');
};
