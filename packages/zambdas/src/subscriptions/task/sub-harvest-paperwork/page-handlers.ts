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
  Task,
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
  TASK_INPUT_TYPE_CODES,
  TASK_INPUT_TYPE_SYSTEM,
  TaskIndicator,
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

export interface HarvestContext {
  qr: QuestionnaireResponse;
  pageLinkId: string;
  patchIndex: number;
  taskId: string;
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

  await patchWithOptimisticLock(oystehr, 'Patient', patient.id!, patient, (currentPatient) => {
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
  const { qr, patient, oystehr } = ctx;

  await patchWithOptimisticLock(oystehr, 'Patient', patient.id!, patient, (currentPatient) => {
    const flattenedItems = flattenQuestionnaireAnswers(qr.item ?? []);
    return createUpdatePharmacyPatchOps(currentPatient, flattenedItems);
  });

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

  // Only update the payment variant extension when the page being harvested is
  // the one that actually contains the payment option answer. Other pages that
  // share the account-coverage strategy should not touch this extension.
  const PAYMENT_OPTION_PAGES = ['payment-option-page', 'payment-option-occ-med-page'];
  const isPaymentOptionPage = PAYMENT_OPTION_PAGES.includes(ctx.pageLinkId);

  let paymentVariant: PaymentVariant | undefined;
  if (isPaymentOptionPage) {
    const selectedPaymentOption = paymentOption ?? occMedPaymentOption;
    if (selectedPaymentOption) {
      paymentVariant = PaymentVariant.selfPay;
      if (selectedPaymentOption === INSURANCE_PAY_OPTION) {
        paymentVariant = PaymentVariant.insurance;
      }
      if (selectedPaymentOption === OCC_MED_EMPLOYER_PAY_OPTION) {
        paymentVariant = PaymentVariant.employer;
      }
    }
  }

  await patchWithOptimisticLock(oystehr, 'Encounter', encounter.id!, encounter, async (currentEncounter) => {
    const ops: Operation[] = [];

    if (paymentVariant !== undefined) {
      const currentVariant = getPaymentVariantFromEncounter(currentEncounter);
      if (currentVariant !== paymentVariant) {
        const extIndex = currentEncounter.extension?.findIndex(
          (ext) => ext.url === ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL
        );

        if (extIndex !== undefined && extIndex >= 0) {
          ops.push({
            op: 'replace',
            path: `/extension/${extIndex}`,
            value: getEncounterPaymentVariantExtension(paymentVariant),
          });
        } else if (currentEncounter.extension) {
          ops.push({ op: 'add', path: '/extension/-', value: getEncounterPaymentVariantExtension(paymentVariant) });
        } else {
          ops.push({ op: 'add', path: '/extension', value: [getEncounterPaymentVariantExtension(paymentVariant)] });
        }
      }
    }

    // Update encounter account references
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

  const verifiedPhone = getPhoneNumberForIndividual(relatedPerson);
  if (!verifiedPhone) {
    console.log(`No verified phone number for patient ${patient.id}, skipping erx-contact harvest`);
    return 'erx-contact skipped (no verified phone)';
  }

  await patchWithOptimisticLock(oystehr, 'Patient', patient.id!, patient, (currentPatient) => {
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
  documents: documentsStrategy,
  consent: consentStrategy,
  'erx-contact': erxContactStrategy,
};

/**
 * Checks whether a more recent harvest Task exists for the same QuestionnaireResponse
 * that would also run the given strategy. If so, the current (older) task should skip
 * that strategy — the newer task reads the same QR with more complete paperwork data,
 * so its results supersede ours.
 *
 * "More recent" is determined by Task.meta.lastUpdated (creation time), not by
 * patchIndex, since pages can be patched out of order.
 */
async function isStrategySupersededByLaterTask(strategy: HarvestStrategy, ctx: HarvestContext): Promise<boolean> {
  const qrId = ctx.qr.id;
  if (!qrId) return false;

  const siblingTasks = (
    await ctx.oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        { name: 'code', value: `${TaskIndicator.harvestPaperwork.system}|${TaskIndicator.harvestPaperwork.code}` },
        { name: 'focus', value: `QuestionnaireResponse/${qrId}` },
        { name: 'status', value: 'requested,in-progress,completed' },
      ],
    })
  ).unbundle();

  // Find the current task to get its authored time (set once at creation, never changes)
  const currentTask = siblingTasks.find((t) => t.id === ctx.taskId);
  const currentTaskTime = currentTask?.authoredOn;
  if (!currentTaskTime) return false;

  for (const sibling of siblingTasks) {
    if (sibling.id === ctx.taskId) continue;

    const siblingTime = sibling.authoredOn;
    if (!siblingTime || siblingTime <= currentTaskTime) continue;

    // Resolve the sibling's page and check if it maps to the same strategy
    const siblingIndex = sibling.input?.find(
      (i) =>
        i.type?.coding?.some((c) => c.system === TASK_INPUT_TYPE_SYSTEM && c.code === TASK_INPUT_TYPE_CODES.PAGE_INDEX)
    )?.valueUnsignedInt;
    if (siblingIndex === undefined) continue;

    const siblingPageLinkId = ctx.qr.item?.[siblingIndex]?.linkId;
    if (!siblingPageLinkId) continue;

    const siblingStrategies = pageHarvestStrategy[siblingPageLinkId];
    if (siblingStrategies?.includes(strategy)) {
      console.log(
        `skipping ${strategy} for page ${ctx.pageLinkId} (task ${ctx.taskId}): ` +
          `newer task ${sibling.id} (page ${siblingPageLinkId}, created ${siblingTime}) will handle it`
      );
      return true;
    }
  }

  return false;
}

export const executePageHarvest = async (ctx: HarvestContext): Promise<string> => {
  const strategies = pageHarvestStrategy[ctx.pageLinkId];
  if (!strategies || strategies.length === 0) {
    return `no harvest strategy registered for ${ctx.pageLinkId}, skipping`;
  }
  console.log(`harvest strategies for page ${ctx.pageLinkId}: ${strategies.join(', ')}`);
  const results: string[] = [];
  for (const strategy of strategies) {
    if (strategy === 'account-coverage' && (await isStrategySupersededByLaterTask(strategy, ctx))) {
      results.push(`${strategy} skipped (superseded by later task)`);
      continue;
    }
    const handler = strategyHandlers[strategy];
    results.push(await handler(ctx));
  }
  return results.join(', ');
};
