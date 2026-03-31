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
  ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL,
  flattenQuestionnaireAnswers,
  getEncounterPaymentVariantExtension,
  getPaymentVariantFromEncounter,
  getPhoneNumberForIndividual,
  getRelatedPersonForPatient,
  type HarvestStrategy,
  INSURANCE_PAY_OPTION,
  OCC_MED_EMPLOYER_PAY_OPTION,
  OCC_MED_SELF_PAY_OPTION,
  pageHarvestStrategy,
  patchWithOptimisticLock,
  PaymentVariant,
  Secrets,
  SELF_PAY_OPTION,
} from 'utils';
import {
  createConsentResources,
  createDocumentResources,
  createErxContactOperation,
  createMasterRecordPatchOperations,
  createUpdatePharmacyPatchOps,
  getAccountAndCoverageResourcesForPatient,
  mergeEncounterAccounts,
  updatePatientAccountFromQuestionnaire,
} from '../../../ehr/shared/harvest';
import { getAuth0Token } from '../../../shared';

type WithId<T> = T & { id: string };

export interface HarvestContext {
  qr: QuestionnaireResponse;
  pageLinkId: string;
  patchIndex: number;
  taskId: string;
  patient: WithId<Patient>;
  encounter: WithId<Encounter>;
  appointment: WithId<Appointment>;
  location: Location | undefined;
  questionnaire: Questionnaire | undefined;
  oystehr: Oystehr;
  secrets: Secrets;
}

type HarvestStrategyHandler = (ctx: HarvestContext) => Promise<string>;

// ── Strategy implementations ────────────────────────────────────────────

const masterRecordStrategy: HarvestStrategyHandler = async (ctx) => {
  const { qr, pageLinkId, patient, questionnaire, oystehr } = ctx;

  await patchWithOptimisticLock(oystehr, patient, (currentPatient) => {
    const patientPatchOps = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: qr.item || [],
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true, includeSections: [pageLinkId] },
      },
      currentPatient
    );
    return patientPatchOps.patient.patchOpsForDirectUpdate;
  });

  return `master record updated for ${pageLinkId}`;
};

const pharmacyStrategy: HarvestStrategyHandler = async (ctx) => {
  const { qr, pageLinkId, patient, oystehr } = ctx;

  const pageItems = (qr.item ?? []).filter((item) => item.linkId === pageLinkId);

  await patchWithOptimisticLock(oystehr, patient, (currentPatient) => {
    const flattenedItems = flattenQuestionnaireAnswers(pageItems);
    return createUpdatePharmacyPatchOps(currentPatient, flattenedItems);
  });

  return 'pharmacy updated';
};

const accountCoverageStrategy: HarvestStrategyHandler = async (ctx) => {
  const { qr, pageLinkId, patient, encounter, questionnaire, oystehr } = ctx;

  // Only process QR items for the page being harvested, not the entire form.
  // This prevents parallel invocations from different pages doing redundant work.
  const pageItems = (qr.item ?? []).filter((item) => item.linkId === pageLinkId);

  // Read payment option from the full QR (not filtered pageItems) so we can
  // correctly determine self-pay status regardless of which page is being processed.
  const paymentOption = qr.item
    ?.find((item) => item.linkId === 'payment-option-page')
    ?.item?.find((subItem) => subItem.linkId === 'payment-option')?.answer?.[0]?.valueString;

  const occMedPaymentOption = qr.item
    ?.find((item) => item.linkId === 'payment-option-occ-med-page')
    ?.item?.find((subItem) => subItem.linkId === 'payment-option-occupational')?.answer?.[0]?.valueString;

  // When processing a non-payment page, we have no coverage data to update,
  // so preserve existing coverages to avoid accidental deletion.
  const isPaymentPage = ['payment-option-page', 'payment-option-occ-med-page'].includes(pageLinkId);
  const isSelfPay = paymentOption === SELF_PAY_OPTION || occMedPaymentOption === OCC_MED_SELF_PAY_OPTION;
  const preserveOmittedCoverages = !isPaymentPage || isSelfPay;

  await updatePatientAccountFromQuestionnaire(
    {
      patientId: patient.id!,
      questionnaireResponseItem: pageItems,
      preserveOmittedCoverages,
      questionnaireForEnableWhenFiltering: questionnaire,
    },
    oystehr
  );

  // Update encounter account references
  await patchWithOptimisticLock(oystehr, encounter, async (currentEncounter) => {
    const ops: Operation[] = [];

    const { account: latestAccount, workersCompAccount } = await getAccountAndCoverageResourcesForPatient(
      patient.id!,
      oystehr
    );

    const patientAccountReference = latestAccount?.id ? `Account/${latestAccount.id}` : undefined;
    const workersCompAccountReference = workersCompAccount?.id ? `Account/${workersCompAccount.id}` : undefined;
    const { accounts: updatedEncounterAccounts, changed: accountsChanged } = mergeEncounterAccounts(
      currentEncounter.account,
      [patientAccountReference, workersCompAccountReference]
    );

    if (accountsChanged && updatedEncounterAccounts) {
      ops.push({
        op: currentEncounter.account ? 'replace' : 'add',
        path: '/account',
        value: updatedEncounterAccounts,
      });
    }

    return ops;
  });

  console.log(`account and coverage resources updated for encounter ${encounter.id}`);

  return 'account / coverage updated';
};

const paymentVariantStrategy: HarvestStrategyHandler = async (ctx) => {
  const { qr, encounter, oystehr } = ctx;

  const paymentOption = qr.item
    ?.find((item) => item.linkId === 'payment-option-page')
    ?.item?.find((subItem) => subItem.linkId === 'payment-option')?.answer?.[0]?.valueString;

  const occMedPaymentOption = qr.item
    ?.find((item) => item.linkId === 'payment-option-occ-med-page')
    ?.item?.find((subItem) => subItem.linkId === 'payment-option-occupational')?.answer?.[0]?.valueString;

  const selectedPaymentOption = paymentOption ?? occMedPaymentOption;
  if (!selectedPaymentOption) {
    return 'payment-variant skipped (no payment option selected)';
  }

  let paymentVariant = PaymentVariant.selfPay;
  if (selectedPaymentOption === INSURANCE_PAY_OPTION) {
    paymentVariant = PaymentVariant.insurance;
  }
  if (selectedPaymentOption === OCC_MED_EMPLOYER_PAY_OPTION) {
    paymentVariant = PaymentVariant.employer;
  }

  await patchWithOptimisticLock(oystehr, encounter, (currentEncounter) => {
    const currentVariant = getPaymentVariantFromEncounter(currentEncounter);
    if (currentVariant === paymentVariant) {
      return [];
    }

    const extIndex = currentEncounter.extension?.findIndex(
      (ext) => ext.url === ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL
    );

    if (extIndex !== undefined && extIndex >= 0) {
      return [
        {
          op: 'replace' as const,
          path: `/extension/${extIndex}`,
          value: getEncounterPaymentVariantExtension(paymentVariant),
        },
      ];
    } else if (currentEncounter.extension) {
      return [{ op: 'add' as const, path: '/extension/-', value: getEncounterPaymentVariantExtension(paymentVariant) }];
    } else {
      return [{ op: 'add' as const, path: '/extension', value: [getEncounterPaymentVariantExtension(paymentVariant)] }];
    }
  });

  return `payment-variant set to ${paymentVariant}`;
};

const documentsStrategy: HarvestStrategyHandler = async (ctx) => {
  const { qr, pageLinkId, patient, appointment, oystehr } = ctx;

  // Only process attachments from the page being harvested
  const pageQr: QuestionnaireResponse = {
    ...qr,
    item: (qr.item ?? []).filter((item) => item.linkId === pageLinkId),
  };

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

  await createDocumentResources(pageQr, patient.id, appointment.id, oystehr, listResources, documentReferenceResources);

  return 'documents created';
};

const consentStrategy: HarvestStrategyHandler = async (ctx) => {
  const { qr, pageLinkId, patient, location, appointment, oystehr, secrets } = ctx;

  const pageQr: QuestionnaireResponse = {
    ...qr,
    item: (qr.item ?? []).filter((item) => item.linkId === pageLinkId),
  };

  // Fetch lists for consent document tracking
  const listResources = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: 'subject', value: `Patient/${patient.id}` }],
    })
  ).unbundle() as List[];

  const oystehrAccessToken = await getAuth0Token(secrets);

  await createConsentResources({
    questionnaireResponse: pageQr,
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

  const verifiedPhone = getPhoneNumberForIndividual(relatedPerson);
  if (!verifiedPhone) {
    console.log(`No verified phone number for patient ${patient.id}, skipping erx-contact harvest`);
    return 'erx-contact skipped (no verified phone)';
  }

  await patchWithOptimisticLock(oystehr, patient, (currentPatient) => {
    const erxContactOp = createErxContactOperation(relatedPerson, currentPatient);
    return erxContactOp ? [erxContactOp] : [];
  });

  return 'erx-contact updated';
};

// ── Strategy registry ───────────────────────────────────────────────────

export const strategyHandlers: Record<HarvestStrategy, HarvestStrategyHandler> = {
  'master-record': masterRecordStrategy,
  pharmacy: pharmacyStrategy,
  'account-coverage': accountCoverageStrategy,
  'payment-variant': paymentVariantStrategy,
  documents: documentsStrategy,
  consent: consentStrategy,
  'erx-contact': erxContactStrategy,
};

export const executePageHarvest = async (ctx: HarvestContext): Promise<string> => {
  const strategies = pageHarvestStrategy[ctx.pageLinkId];
  if (!strategies || strategies.length === 0) {
    return `no harvest strategy registered for ${ctx.pageLinkId}, skipping`;
  }
  console.log(`harvest strategies for page ${ctx.pageLinkId}: ${strategies.join(', ')}`);
  const results: string[] = [];
  for (const strategy of strategies) {
    const handler = strategyHandlers[strategy];
    results.push(await handler(ctx));
  }
  return results.join(', ');
};
