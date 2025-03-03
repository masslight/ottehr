import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import {
  Account,
  Appointment,
  Coverage,
  Encounter,
  InsurancePlan,
  List,
  Location,
  Organization,
  Patient,
  QuestionnaireResponseItem,
  RelatedPerson,
} from 'fhir/r4b';
import { flattenIntakeQuestionnaireItems, getRelatedPersonForPatient, IntakeQuestionnaireItem } from 'utils';
import { getSecret, SecretsKeys, topLevelCatch, triggerSlackAlarm, ZambdaInput } from 'zambda-utils';
import '../../../../instrument.mjs';
import { captureSentryException, configSentry, getAuth0Token } from '../../../shared';
import { createOystehrClient } from '../../../shared/helpers';
import {
  createConsentResources,
  createDocumentResources,
  createErxContactOperation,
  createMasterRecordPatchOperations,
  flagPaperworkEdit,
  getAccountOperations,
  getCoverageUpdateResourcesFromUnbundled,
  searchInsuranceInformation,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';
import { BatchInputRequest } from '@oystehr/sdk';

let zapehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('sub-intake-harvest', input.secrets);
  console.log('Intake Harvest Hath Been Invoked');
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { qr, secrets } = validatedParameters;
    console.log('questionnaire reponse id', qr.id);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);

    const tasksFailed: string[] = [];

    console.time('querying for resources to support qr harvest');
    const resources = (
      await oystehr.fhir.search<Encounter | Patient | Appointment | Location | RelatedPerson | List>({
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

    // get insurance additional information
    const insurancePlans = [];
    const primaryInsurancePlan = flattenedPaperwork.find((item) => item.linkId === 'insurance-carrier')?.answer?.[0]
      ?.valueReference?.reference;
    if (primaryInsurancePlan) insurancePlans.push(primaryInsurancePlan);
    const secondaryInsurancePlan = flattenedPaperwork.find((item) => item.linkId === 'insurance-carrier-2')?.answer?.[0]
      ?.valueReference?.reference;
    if (secondaryInsurancePlan) insurancePlans.push(secondaryInsurancePlan);
    const insuranceInformationResources = await searchInsuranceInformation(oystehr, insurancePlans);
    const insurancePlanResources = insuranceInformationResources.filter(
      (res): res is InsurancePlan => res.resourceType === 'InsurancePlan'
    );
    const organizationResources = insuranceInformationResources.filter(
      (res): res is Organization => res.resourceType === 'Organization'
    );

    /*const patientMasterRecordResources: PatientMasterRecordResources = {
      patient: patientResource,
      coverages: coverageResources,
      relatedPersons: relatedPersonResources,
    };
    console.log('Patient Master Record resources: ', JSON.stringify(patientMasterRecordResources, null, 2));
    console.log('Insurance information resources: ', JSON.stringify(insuranceInformationResources, null, 2));
    */

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

    /*
    if (hasConflictingUpdates(patientPatchOps)) {
      const task = createConflictResolutionTask(patientPatchOps, patientMasterRecordResources, qr.id);
      try {
        console.time('creating conflict resolution task resource');
        await oystehr.fhir.create(task);
        console.timeEnd('creating conflict resolution task resource');
      } catch (error) {
        console.log(`Failed to create conflict review task: ${JSON.stringify(error)}`);
        throw new Error('Failed to create conflict review task');
      }
    }*/

    console.time('querying for Account and Coverage resources');
    const accountAndCoverageResources = (
      await oystehr.fhir.search<Account | Coverage | RelatedPerson | Patient>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient._id',
            value: patientResource.id,
          },
          {
            name: 'status',
            value: 'active',
          },
          {
            name: '_include',
            value: 'Account:patient',
          },
          {
            name: '_revinclude:iterate',
            value: 'RelatedPerson:patient',
          },
          {
            name: '_revinclude:iterate',
            value: 'Coverage:patient',
          },
          {
            name: '_include:iterate',
            value: 'Coverage:subscriber',
          },
        ],
      })
    ).unbundle();
    console.timeEnd('querying for Account and Coverage resources');

    console.log('creating account and coverage operations');
    const { existingCoverages, existingAccount, existingGuarantorResource } = getCoverageUpdateResourcesFromUnbundled({
      patient: patientResource,
      resources: accountAndCoverageResources,
    });

    console.log('existing coverages', JSON.stringify(existingCoverages, null, 2));
    console.log('existing account', JSON.stringify(existingAccount, null, 2));
    console.log('existing guarantor resource', JSON.stringify(existingGuarantorResource, null, 2));

    const accountOperations = getAccountOperations({
      patient: patientResource,
      questionnaireResponseItem: paperwork,
      insurancePlanResources,
      organizationResources,
      existingCoverages,
      existingAccount,
      existingGuarantorResource,
    });

    console.log('account and coverage operations created', JSON.stringify(accountOperations, null, 2));

    const { patch, accountPost, coveragePosts } = accountOperations;
    console.time('patching account resource');
    const transactionRequests: BatchInputRequest<Account | RelatedPerson | Coverage>[] = [...coveragePosts, ...patch];
    if (accountPost) {
      transactionRequests.push({
        url: '/Account',
        method: 'POST',
        resource: accountPost,
      });
    }

    try {
      await oystehr.fhir.transaction({ requests: transactionRequests });
    } catch (error: unknown) {
      tasksFailed.push('patch account');
      console.log(`Failed to update Account: ${JSON.stringify(error)}`);
    }
    console.timeEnd('patching account resource');

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
          oystehrAccessToken: zapehrToken,
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
        tasksFailed.push('patch patient');
        console.log(`Failed to update Patient: ${JSON.stringify(error)}`);
      }
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
        `Alert in ${ENVIRONMENT} zambda qr-subscriotion.\n\nOne or more harvest paperwork tasks failed for QR ${qr.id}:\n\n${tasksFailed}`,
        secrets
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    return topLevelCatch('qr-subscription', error, input.secrets, captureSentryException);
  }
});
