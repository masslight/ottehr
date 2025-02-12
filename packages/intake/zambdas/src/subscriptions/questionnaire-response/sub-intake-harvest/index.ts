import { BatchInputPostRequest } from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import {
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
  createConflictResolutionTask,
  createConsentResources,
  createDocumentResources,
  createErxContactOperation,
  createInsuranceResources,
  createMasterRecordPatchOperations,
  flagPaperworkEdit,
  hasConflictingUpdates,
  PatientMasterRecordResources,
  searchInsuranceInformation,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

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
      await oystehr.fhir.search<Encounter | Patient | Appointment | Location | Coverage | RelatedPerson | List>({
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
            value: 'Coverage:patient',
          },
          {
            name: '_include:iterate',
            value: 'Coverage:subscriber:RelatedPerson',
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
    const coverageResources = resources
      .filter((res): res is Coverage => res.resourceType === 'Coverage')
      .filter((coverage) => coverage.status === 'active') as Coverage[];
    const relatedPersonResources = resources.filter(
      (res): res is RelatedPerson => res.resourceType === 'RelatedPerson'
    );
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

    const patientMasterRecordResources: PatientMasterRecordResources = {
      patient: patientResource,
      coverages: coverageResources,
      relatedPersons: relatedPersonResources,
    };
    console.log('Patient Master Record resources: ', JSON.stringify(patientMasterRecordResources, null, 2));

    console.log('creating patch operations');
    const patientPatchOps = createMasterRecordPatchOperations(qr, patientMasterRecordResources);

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

    console.time('patching coverages resources');
    for (const [coverageId, ops] of Object.entries(patientPatchOps.coverage)) {
      if (ops.patchOpsForDirectUpdate.length > 0) {
        try {
          await oystehr.fhir.patch({
            resourceType: 'Coverage',
            id: coverageId,
            operations: ops.patchOpsForDirectUpdate,
          });
        } catch (error: unknown) {
          tasksFailed.push('patch coverage');
          console.log(`Failed to update Coverage: ${JSON.stringify(error)}`);
        }
      }
    }
    console.timeEnd('patching coverages resources');

    console.time('patching policy holders resources');
    for (const [relatedPersonId, ops] of Object.entries(patientPatchOps.relatedPerson)) {
      if (ops.patchOpsForDirectUpdate.length > 0) {
        try {
          await oystehr.fhir.patch({
            resourceType: 'RelatedPerson',
            id: relatedPersonId,
            operations: ops.patchOpsForDirectUpdate,
          });
        } catch (error: unknown) {
          tasksFailed.push('patch policy holder');
          console.log(`Failed to update RelatedPerson: ${JSON.stringify(error)}`);
        }
      }
    }
    console.timeEnd('patching policy holders resources');

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
    }

    const newPatientMasterRecordResources = createInsuranceResources({
      questionnaireResponse: qr,
      resources: patientMasterRecordResources,
      insurancePlanResources,
      organizationResources,
    });
    if (newPatientMasterRecordResources?.coverage?.length || newPatientMasterRecordResources?.relatedPerson?.length) {
      console.time('creating insurance resources');
      const newCoveragesRequests: BatchInputPostRequest<Coverage>[] = [];
      for (const resource of newPatientMasterRecordResources.coverage ?? []) {
        const writeCoverageReq: BatchInputPostRequest<Coverage> = {
          method: 'POST',
          url: '/Coverage',
          resource: resource as Coverage,
        };
        newCoveragesRequests.push(writeCoverageReq);
      }
      const newRelatedPersonsRequests: BatchInputPostRequest<RelatedPerson>[] = [];
      for (const resource of newPatientMasterRecordResources.relatedPerson ?? []) {
        const writeRelatedPersonReq: BatchInputPostRequest<RelatedPerson> = {
          method: 'POST',
          url: '/RelatedPerson',
          resource: resource as RelatedPerson,
        };
        newRelatedPersonsRequests.push(writeRelatedPersonReq);
      }
      try {
        const response = await oystehr.fhir.batch<Coverage | RelatedPerson>({
          requests: [...newCoveragesRequests, ...newRelatedPersonsRequests],
        });
        console.log('batch-response:', JSON.stringify(response));
      } catch (error: unknown) {
        tasksFailed.push('create insurance resources');
        console.log(`Failed to create insurance resources: ${error}`);
      }
      console.timeEnd('creating insurance resources');
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
