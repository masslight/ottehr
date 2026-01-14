import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import {
  Account,
  Appointment,
  Coding,
  DocumentReference,
  Encounter,
  List,
  Location,
  Observation,
  Patient,
  Questionnaire,
  QuestionnaireResponseItem,
} from 'fhir/r4b';
import {
  ADDITIONAL_QUESTIONS_META_SYSTEM,
  FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG,
  flattenIntakeQuestionnaireItems,
  flattenQuestionnaireAnswers,
  getCanonicalQuestionnaire,
  getPatchOperationsForNewMetaTags,
  getRelatedPersonForPatient,
  getSecret,
  IntakeQuestionnaireItem,
  PaymentVariant,
  SecretsKeys,
  updateEncounterPaymentVariantExtension,
} from 'utils';
import {
  createConsentResources,
  createDocumentResources,
  createErxContactOperation,
  createMasterRecordPatchOperations,
  createUpdatePharmacyPatchOps,
  flagPaperworkEdit,
  getAccountAndCoverageResourcesForPatient,
  updatePatientAccountFromQuestionnaire,
  updateStripeCustomer,
} from '../../../ehr/shared/harvest';
import { getStripeClient } from '../../../patient/payment-methods/helpers';
import {
  createOystehrClient,
  getAuth0Token,
  makeObservationResource,
  saveResourceRequest,
  topLevelCatch,
  triggerSlackAlarm,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { createAdditionalQuestions } from '../../appointment/appointment-chart-data-prefilling/helpers';
import { QRSubscriptionInput, validateRequestParameters } from './validateRequestParameters';

let oystehrToken: string;

export const index = wrapHandler('sub-intake-harvest', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log('Intake Harvest Hath Been Invoked');
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { qr, secrets } = validatedParameters;
    console.log('questionnaire response id', qr.id);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);
    const response = await performEffect(validatedParameters, oystehr);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('qr-subscription', error, ENVIRONMENT);
  }
});

// this is exported to facilitate integration testing
export const performEffect = async (input: QRSubscriptionInput, oystehr: Oystehr): Promise<string> => {
  const { qr, secrets } = input;

  if (qr.status !== 'completed' && qr.status !== 'amended') {
    console.log(`Skipping harvest for QR ${qr.id} with status=${qr.status}`);
    return `skipped: status=${qr.status}`;
  }

  const tasksFailed: string[] = [];
  let updatedAccount: Account | undefined;
  let workersCompAccount: Account | undefined;

  console.time('querying for resources to support qr harvest');
  const resources = (
    await oystehr.fhir.search<Encounter | Patient | Appointment | Location | List | DocumentReference>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: qr.encounter?.reference?.replace('Encounter/', '') ?? '',
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:patient',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:location',
        },
        {
          name: '_revinclude:iterate',
          value: 'List:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'DocumentReference:patient',
        },
      ],
    })
  ).unbundle();
  console.timeEnd('querying for resources to support qr harvest');

  // Fetch questionnaire for enableWhen filtering
  const questionnaireForEnableWhenFiltering = await (async (): Promise<Questionnaire | undefined> => {
    if (qr.questionnaire) {
      const parts = qr.questionnaire.split('|');
      if (parts.length === 2 && parts[0] && parts[1]) {
        try {
          return await getCanonicalQuestionnaire({ url: parts[0], version: parts[1] }, oystehr);
        } catch (error) {
          console.warn(`Failed to fetch questionnaire ${qr.questionnaire}:`, error);
        }
      }
    }
    return undefined;
  })();

  const encounterResource = resources.find((res) => res.resourceType === 'Encounter') as Encounter | undefined;
  let patientResource = resources.find((res) => res.resourceType === 'Patient') as Patient | undefined;
  const listResources = resources.filter((res) => res.resourceType === 'List') as List[];
  const documentReferenceResources = resources.filter(
    (res) => res.resourceType === 'DocumentReference'
  ) as DocumentReference[];
  const locationResource = resources.find((res) => res.resourceType === 'Location') as Location | undefined;
  const appointmentResource = resources.find((res) => res.resourceType === 'Appointment') as Appointment | undefined;

  if (patientResource === undefined || patientResource.id === undefined) {
    throw new Error('Patient resource not found');
  }

  console.log('creating patch operations');
  const patientPatchOps = createMasterRecordPatchOperations(
    qr.item || [],
    patientResource,
    questionnaireForEnableWhenFiltering
  );

  console.log('All Patient patch operations being attempted: ', JSON.stringify(patientPatchOps, null, 2));

  if (patientPatchOps.patient.patchOpsForDirectUpdate.length > 0) {
    console.time('patching patient resource');
    try {
      patientResource = await oystehr.fhir.patch<Patient>({
        resourceType: 'Patient',
        id: patientResource.id!,
        operations: patientPatchOps.patient.patchOpsForDirectUpdate,
      });
      console.timeEnd('patching patient resource');
      console.log('Patient update successful');
    } catch (error: unknown) {
      tasksFailed.push('patch patient');
      console.log(`Failed to update Patient: ${JSON.stringify(error)}`);
      captureException(error);
    }
  }
  // combining these patch ops with patientPatchOps caused a bug so keeping separate for now
  const pharmacyPatchOps = createUpdatePharmacyPatchOps(patientResource, flattenQuestionnaireAnswers(qr.item ?? []));
  if (pharmacyPatchOps.length > 0) {
    console.log('Applying pharmacy patch operations: ', JSON.stringify(pharmacyPatchOps, null, 2));
    patientResource = await oystehr.fhir.patch<Patient>({
      resourceType: 'Patient',
      id: patientResource.id!,
      operations: pharmacyPatchOps,
    });
  }

  if (patientResource === undefined || patientResource.id === undefined) {
    throw new Error('Patient resource not found');
  }

  console.log(`Running harvest for QR ${qr.id}`);

  try {
    // if the user selects the self-pay option, we don't want to remove any coverages that already exist on the account
    const preserveOmittedCoverages =
      qr.item
        ?.find((item) => item.linkId === 'payment-option-page')
        ?.item?.find((subItem) => subItem.linkId === 'payment-option')?.answer?.[0]?.valueString ===
      'I will pay without insurance';
    await updatePatientAccountFromQuestionnaire(
      { patientId: patientResource.id, questionnaireResponseItem: qr.item ?? [], preserveOmittedCoverages },
      oystehr
    );
  } catch (error: unknown) {
    tasksFailed.push(`Failed to update Account: ${JSON.stringify(error)}`);
    console.log(`Failed to update Account: ${JSON.stringify(error)}`);
    captureException(error);
  }
  // fetch the latest account resources and update the stripe customer
  try {
    // refetch the patient account resources
    const {
      account: latestAccount,
      guarantorResource: updatedGuarantorResource,
      workersCompAccount: latestWorkersCompAccount,
    } = await getAccountAndCoverageResourcesForPatient(patientResource.id, oystehr);
    updatedAccount = latestAccount;
    workersCompAccount = latestWorkersCompAccount;
    if (updatedAccount && updatedGuarantorResource) {
      console.time('updating stripe customer');
      const stripeClient = getStripeClient(secrets);
      await updateStripeCustomer(
        {
          account: updatedAccount,
          guarantorResource: updatedGuarantorResource,
          stripeClient,
        },
        oystehr
      );
      console.timeEnd('updating stripe customer');
    } else {
      console.log('Stripe customer id, account or guarantor resource missing, skipping stripe customer update');
    }
  } catch (error: unknown) {
    tasksFailed.push('update stripe customer');
    console.log(`Failed to update stripe customer: ${JSON.stringify(error)}`);
    captureException(error);
  }

  const paperwork = qr.item ?? [];
  const flattenedPaperwork = flattenIntakeQuestionnaireItems(
    paperwork as IntakeQuestionnaireItem[]
  ) as QuestionnaireResponseItem[];

  const hipaa = flattenedPaperwork.find((data) => data.linkId === 'hipaa-acknowledgement')?.answer?.[0]?.valueBoolean;
  const consentToTreat = flattenedPaperwork.find((data) => data.linkId === 'consent-to-treat')?.answer?.[0]
    ?.valueBoolean;

  if (appointmentResource === undefined || appointmentResource.id === undefined) {
    throw new Error('Appointment resource not found');
  }

  // only create the consent resources once when qr goes to completed.
  // it seems QR is saved twice in rapid succession on submission
  if (hipaa === true && consentToTreat === true && qr.status === 'completed') {
    console.time('creating consent resources');
    try {
      await createConsentResources({
        questionnaireResponse: qr,
        patientResource,
        locationResource,
        appointmentId: appointmentResource.id,
        oystehrAccessToken: oystehrToken,
        oystehr,
        secrets,
        listResources,
      });
    } catch (error: unknown) {
      tasksFailed.push('create consent resources');
      console.log(`Failed to create consent resources: ${error}`);
      captureException(error);
    }
    console.timeEnd('creating consent resources');
  }

  console.time('creating insurances cards, condition photo, work school notes resources');
  try {
    await createDocumentResources(
      qr,
      patientResource.id,
      appointmentResource.id,
      oystehr,
      listResources,
      documentReferenceResources
    );
  } catch (error: unknown) {
    tasksFailed.push('create insurances cards, condition photo, work school notes resources');
    console.log(`Failed to create insurances cards, condition photo, work school notes resources: ${error}`);
    captureException(error);
  }
  console.timeEnd('creating insurances cards, condition photo, work school notes resources');

  if (encounterResource === undefined || encounterResource.id === undefined) {
    throw new Error('Encounter resource not found');
  }

  if (qr.status === 'amended') {
    try {
      console.log('flagging paperwork edit');
      await flagPaperworkEdit(patientResource.id, encounterResource.id, oystehr);
    } catch (error: unknown) {
      tasksFailed.push('flag paperwork edit');
      console.log(`Failed to update flag paperwork edit: ${error}`);
      captureException(error);
    }
  }

  if (qr.status === 'completed' || qr.status === 'amended') {
    try {
      console.log('updating encounter payment variant and account references');
      const paymentOption = flattenedPaperwork.find(
        (response: QuestionnaireResponseItem) => response.linkId === 'payment-option'
      )?.answer?.[0]?.valueString;
      let paymentVariant: PaymentVariant = PaymentVariant.selfPay;
      if (paymentOption === 'I have insurance') {
        paymentVariant = PaymentVariant.insurance;
      }
      if (paymentOption === 'Employer') {
        paymentVariant = PaymentVariant.employer;
      }
      const updatedEncounter = updateEncounterPaymentVariantExtension(encounterResource, paymentVariant);
      const encounterPatchOperations: Operation[] = [
        {
          op: encounterResource.extension !== undefined ? 'replace' : 'add',
          path: '/extension',
          value: updatedEncounter.extension,
        },
      ];

      const patientAccountReference = updatedAccount?.id ? `Account/${updatedAccount.id}` : undefined;
      const workersCompAccountReference = workersCompAccount?.id ? `Account/${workersCompAccount.id}` : undefined;
      const { accounts: updatedEncounterAccounts, changed: accountsChanged } = mergeEncounterAccounts(
        encounterResource.account,
        [patientAccountReference, workersCompAccountReference]
      );

      if (accountsChanged && updatedEncounterAccounts) {
        encounterPatchOperations.push({
          op: encounterResource.account ? 'replace' : 'add',
          path: '/account',
          value: updatedEncounterAccounts,
        });
      }

      if (encounterPatchOperations.length) {
        await oystehr.fhir.patch<Encounter>({
          id: encounterResource.id,
          resourceType: 'Encounter',
          operations: encounterPatchOperations,
        });
      }
      console.log('payment variant and account references updated on encounter');
    } catch (error: unknown) {
      tasksFailed.push('update encounter payment variant/accounts');
      console.log(`Failed to update encounter payment variant/accounts: ${error}`);
      captureException(error);
    }
  }

  console.time('querying for related person for patient self');
  const relatedPerson = await getRelatedPersonForPatient(patientResource.id, oystehr);
  console.timeEnd('querying for related person for patient self');

  if (!relatedPerson || !relatedPerson.id) {
    throw new Error('RelatedPerson for patient is not defined or does not have ID');
  }

  const patientPatches: Operation[] = [];
  const erxContactOperation = createErxContactOperation(relatedPerson, patientResource);
  if (erxContactOperation) patientPatches.push(erxContactOperation);
  //TODO: remove addDefaultCountryOperation after country selection is supported in paperwork
  // to improve: this operation will fail if earlier patch operation necessary to insert an address fails
  const addDefaultCountryOperation: Operation = {
    op: 'add',
    path: '/address/0/country',
    value: 'US',
  };
  patientPatches.push(addDefaultCountryOperation);
  if (patientPatches.length > 0) {
    try {
      console.time('patching patient resource');
      await oystehr.fhir.patch({
        resourceType: 'Patient',
        id: patientResource.id,
        operations: patientPatches,
      });
      console.timeEnd('patching patient resource');
    } catch (error: unknown) {
      tasksFailed.push(JSON.stringify(error));
      console.log(`Failed to update Patient: ${JSON.stringify(error)}`);
      captureException(error);
    }
  }

  try {
    // Additional questions chart data resource prefilling
    const additionalQuestions = createAdditionalQuestions(qr);
    const saveOrUpdateChartDataResourceRequests: (
      | BatchInputPostRequest<Observation>
      | BatchInputPatchRequest<Appointment>
    )[] = [];

    additionalQuestions.forEach((observation) => {
      console.log('additionalQuestion: ', JSON.stringify(observation));
      saveOrUpdateChartDataResourceRequests.push(
        saveResourceRequest(
          makeObservationResource(
            encounterResource.id!,
            patientResource.id!,
            '',
            undefined,
            observation,
            ADDITIONAL_QUESTIONS_META_SYSTEM
          )
        )
      );
    });

    // Add HARVESTING_COMPLETED tag in the same batch transaction
    // This ensures the tag is only set after all resources are created and indexed
    const newTags: Coding[] = [FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG];
    const patchOps = getPatchOperationsForNewMetaTags(appointmentResource, newTags);
    saveOrUpdateChartDataResourceRequests.push({
      method: 'PATCH',
      url: `Appointment/${appointmentResource.id}`,
      operations: patchOps,
    });

    await oystehr.fhir.batch<Observation | Appointment>({
      requests: saveOrUpdateChartDataResourceRequests,
    });
  } catch (error: unknown) {
    tasksFailed.push('create additional questions chart data resource or patch appointment tag', JSON.stringify(error));
    console.log(`Failed to create additional questions chart data resource or patch appointment tag: ${error}`);
    captureException(error);
  }

  const response = tasksFailed.length
    ? `${tasksFailed.length} failed: ${tasksFailed}`
    : 'all tasks executed successfully';
  console.log(response);

  // this alert will fire if tasks fail in testing env so having the env in the message is helpful
  // since it will come into the staging env slack channel
  // we should not send for local development
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  if (tasksFailed.length && ENVIRONMENT !== 'local') {
    await triggerSlackAlarm(
      `Alert in ${ENVIRONMENT} zambda qr-subscription.\n\nOne or more harvest paperwork tasks failed for QR ${qr.id}:\n\n${tasksFailed}`,
      secrets
    );
  }

  return response;
};

const mergeEncounterAccounts = (
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
