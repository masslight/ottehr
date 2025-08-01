import Oystehr, { BatchInputPostRequest, Bundle } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  Encounter,
  FhirResource,
  List,
  Location,
  Observation,
  Patient,
  QuestionnaireResponseItem,
} from 'fhir/r4b';
import {
  ADDITIONAL_QUESTIONS_META_SYSTEM,
  checkBundleOutcomeOk,
  FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG,
  flattenIntakeQuestionnaireItems,
  getRelatedPersonForPatient,
  getSecret,
  IntakeQuestionnaireItem,
  SecretsKeys,
} from 'utils';
import {
  createConsentResources,
  createDocumentResources,
  createErxContactOperation,
  createMasterRecordPatchOperations,
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
  const tasksFailed: string[] = [];

  console.time('querying for resources to support qr harvest');
  const resources = (
    await oystehr.fhir.search<Encounter | Patient | Appointment | Location | List>({
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
      ],
    })
  ).unbundle();
  console.timeEnd('querying for resources to support qr harvest');

  const encounterResource = resources.find((res) => res.resourceType === 'Encounter') as Encounter | undefined;
  const patientResource = resources.find((res) => res.resourceType === 'Patient') as Patient | undefined;
  const listResources = resources.filter((res) => res.resourceType === 'List') as List[];
  const locationResource = resources.find((res) => res.resourceType === 'Location') as Location | undefined;
  const appointmentResource = resources.find((res) => res.resourceType === 'Appointment') as Appointment | undefined;

  const paperwork = qr.item ?? [];
  const flattenedPaperwork = flattenIntakeQuestionnaireItems(
    paperwork as IntakeQuestionnaireItem[]
  ) as QuestionnaireResponseItem[];

  if (patientResource === undefined || patientResource.id === undefined) {
    throw new Error('Patient resource not found');
  }

  console.log('creating patch operations');
  const patientPatchOps = createMasterRecordPatchOperations(qr, patientResource);

  console.log('All Patient patch operations being attempted: ', JSON.stringify(patientPatchOps, null, 2));

  console.time('patching patient resource');
  if (patientPatchOps.patient.patchOpsForDirectUpdate.length > 0) {
    try {
      await oystehr.fhir.patch({
        resourceType: 'Patient',
        id: patientResource.id!,
        operations: patientPatchOps.patient.patchOpsForDirectUpdate,
      });
    } catch (error: unknown) {
      tasksFailed.push('patch patient');
      console.log(`Failed to update Patient: ${JSON.stringify(error)}`);
    }
  }
  console.timeEnd('patching patient resource');

  // we hold onto this in order to use the updated resources to update the stripe customer name and email
  let accountBundle: Bundle<FhirResource> | undefined;

  try {
    accountBundle = (await updatePatientAccountFromQuestionnaire(
      { patientId: patientResource.id, questionnaireResponseItem: flattenedPaperwork },
      oystehr
    )) as Bundle<FhirResource> | undefined;
  } catch (error: unknown) {
    tasksFailed.push(`Failed to update Account: ${JSON.stringify(error)}`);
    console.log(`Failed to update Account: ${JSON.stringify(error)}`);
  }
  // if the account update was successful, fetch the latest account resources and update the stripe customer
  if (accountBundle && checkBundleOutcomeOk(accountBundle)) {
    try {
      // refetch the patient account resources
      const { account: updatedAccount, guarantorResource: updatedGuarantorResource } =
        await getAccountAndCoverageResourcesForPatient(patientResource.id, oystehr);
      if (updatedAccount && updatedGuarantorResource) {
        console.time('updating stripe customer');
        const stripeClient = getStripeClient(secrets);
        await updateStripeCustomer({
          account: updatedAccount,
          guarantorResource: updatedGuarantorResource,
          stripeClient,
        });
        console.timeEnd('updating stripe customer');
      } else {
        console.log('account or guarantor resource missing, skipping stripe customer update');
      }
    } catch (error: unknown) {
      tasksFailed.push('update stripe customer');
      console.log(`Failed to update stripe customer: ${JSON.stringify(error)}`);
    }
  } else {
    console.log('Account bundle is not ok, skipping update stripe customer');
  }

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
    }
    console.timeEnd('creating consent resources');
  }

  console.time('creating insurances cards, condition photo, work school notes resources');
  try {
    await createDocumentResources(qr, patientResource.id, appointmentResource.id, oystehr, listResources);
  } catch (error: unknown) {
    tasksFailed.push('create insurances cards, condition photo, work school notes resources');
    console.log(`Failed to create insurances cards, condition photo, work school notes resources: ${error}`);
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
    }
  }

  try {
    // Additional questions chart data resource prefilling
    const additionalQuestions = createAdditionalQuestions(qr);
    const saveOrUpdateChartDataResourceRequests: BatchInputPostRequest<Observation>[] = [];

    additionalQuestions.forEach((observation) => {
      console.log('additionalQuestion: ', JSON.stringify(observation));
      saveOrUpdateChartDataResourceRequests.push(
        saveResourceRequest(
          makeObservationResource(
            encounterResource.id!,
            patientResource.id!,
            '',
            observation,
            ADDITIONAL_QUESTIONS_META_SYSTEM
          )
        )
      );
    });
    await oystehr.fhir.batch({
      requests: saveOrUpdateChartDataResourceRequests,
    });
  } catch (error: unknown) {
    tasksFailed.push('create additional questions chart data resource', JSON.stringify(error));
    console.log(`Failed to create additional questions chart data resource: ${error}`);
  }

  try {
    console.time('Patching appointment resource tag');
    await oystehr.fhir.patch({
      resourceType: 'Appointment',
      id: appointmentResource.id,
      operations: [{ op: 'add', path: '/meta/tag/-', value: FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG }],
    });
    console.timeEnd('Patching appointment resource tag');
  } catch (error: unknown) {
    tasksFailed.push('patch appointment resource tag failed', JSON.stringify(error));
    console.log(`Failed to patch appointment resource tag: ${JSON.stringify(error)}`);
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
