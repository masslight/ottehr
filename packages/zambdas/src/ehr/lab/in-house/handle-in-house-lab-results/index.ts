import Oystehr, {
  BatchInputPatchRequest,
  BatchInputPostRequest,
  BatchInputPutRequest,
  BatchInputRequest,
} from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Operation } from 'fast-json-patch';
import {
  ActivityDefinition,
  CodeableConcept,
  DiagnosticReport,
  Encounter,
  Extension,
  FhirResource,
  Location,
  Observation,
  ObservationDefinition,
  Patient,
  Practitioner,
  Provenance,
  Quantity,
  Reference,
  Schedule,
  ServiceRequest,
  Specimen,
  Task,
  ValueSet,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ABNORMAL_OBSERVATION_INTERPRETATION,
  ABNORMAL_RESULT_DR_TAG,
  activityDefinitionIsReflexTest,
  checkIfReflexIsTriggered,
  extractAbnormalValueSetValues,
  extractQuantityRange,
  getAttendingPractitionerId,
  getFullestAvailableName,
  getPatchOperationsForNewMetaTags,
  getPatchOperationToRemoveMetaTags,
  getSecret,
  HandleInHouseLabResultsZambdaOutput,
  IN_HOUSE_DIAGNOSTIC_REPORT_CATEGORY_CONFIG,
  IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG,
  IN_HOUSE_LAB_TASK,
  IN_HOUSE_OBS_DEF_ID_SYSTEM,
  INCONCLUSIVE_RESULT_DR_TAG,
  INDETERMINATE_OBSERVATION_INTERPRETATION,
  LabComponentValueSetConfig,
  NEUTRAL_RESULT_DR_TAG,
  NonNormalResult,
  NORMAL_OBSERVATION_INTERPRETATION,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  REFLEX_TEST_TO_RUN_NAME_URL,
  ResultEntryInput,
  SecretsKeys,
  SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_CODES,
  SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_SYSTEM,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { createInHouseLabResultPDF } from '../../../../shared/pdf/labs-results-form-pdf';
import { createOwnerReference } from '../../../../shared/tasks';
import {
  getRelatedServiceRequests,
  getUrlAndVersionForADFromServiceRequest,
  provenanceIsInHouseLabResultEntry,
} from '../../shared/in-house-labs';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'handle-in-house-lab-results';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`handle-in-house-lab-results started, input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { serviceRequestId, data: resultsEntryData, secrets, userToken } = validateRequestParameters(input);
    console.log('validateRequestParameters success');

    console.log('Getting token');
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    console.log('token', m2mToken);

    const oystehr = createOystehrClient(m2mToken, secrets);
    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    const curUserPractitionerId = await getMyPractitionerId(oystehrCurrentUser);

    const {
      serviceRequest,
      encounter,
      patient,
      inputResultTask,
      specimen,
      activityDefinition,
      currentUserPractitioner,
      attendingPractitioner,
      schedule,
      location,
      relatedServiceRequests,
      existingDiagnosticReport,
      resultEntryMode,
    } = await getInHouseLabResultResources(serviceRequestId, curUserPractitionerId, oystehr);

    const currentUserPractitionerName = getFullestAvailableName(currentUserPractitioner);
    const attendingPractitionerName = getFullestAvailableName(attendingPractitioner);

    const requests = makeResultEntryRequests(
      serviceRequest,
      inputResultTask,
      specimen,
      activityDefinition,
      resultsEntryData,
      { id: curUserPractitionerId, name: currentUserPractitionerName },
      { id: attendingPractitioner.id || '', name: attendingPractitionerName },
      relatedServiceRequests,
      existingDiagnosticReport,
      resultEntryMode
    );

    console.log(`These are the fhir requests getting made: ${JSON.stringify(requests)}`);
    const res = await oystehr.fhir.transaction({ requests });

    let diagnosticReport: DiagnosticReport | undefined;
    let resultEntryProvenance: Provenance | undefined;
    const observations: Observation[] = [];
    res.entry?.forEach((entry) => {
      if (entry.resource?.resourceType === 'DiagnosticReport') {
        diagnosticReport = entry.resource as DiagnosticReport;
      }
      if (entry.resource?.resourceType === 'Provenance') {
        const provenance = entry.resource;
        if (provenanceIsInHouseLabResultEntry(provenance)) {
          resultEntryProvenance = provenance;
        }
      }
      if (entry.resource?.resourceType === 'Observation') {
        observations.push(entry.resource as Observation);
      }
    });
    if (!diagnosticReport)
      throw new Error(
        `There was an issue creating and/or parsing the diagnostic report for this service request: ${serviceRequest.id}`
      );
    if (!resultEntryProvenance)
      throw new Error(
        `There was an issue updating and/or parsing the provenance for this action, related to result entry for ServiceRequest/${serviceRequest.id}`
      );
    if (!observations.length) {
      throw new Error(
        `There was an issue creating and/or parsing the observations task for this service request: ${serviceRequest.id}`
      );
    }

    try {
      await createInHouseLabResultPDF(
        oystehr,
        serviceRequest,
        encounter,
        patient,
        location,
        schedule,
        attendingPractitioner,
        attendingPractitionerName,
        resultEntryProvenance,
        observations,
        diagnosticReport,
        secrets,
        m2mToken,
        activityDefinition,
        relatedServiceRequests,
        specimen
      );
    } catch (e) {
      console.log('there was an error creating the result pdf for this service request', serviceRequest.id);
      console.log('error:', e, JSON.stringify(e));
    }

    const response: HandleInHouseLabResultsZambdaOutput = {};

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Error handling in-house lab results:', error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('handle-in-house-lab-results', error, ENVIRONMENT);
  }
});

const getInHouseLabResultResources = async (
  serviceRequestId: string,
  curUserPractitionerId: string,
  oystehr: Oystehr
): Promise<{
  serviceRequest: ServiceRequest;
  encounter: Encounter;
  patient: Patient;
  inputResultTask: Task | undefined; // will only be returned for initial entry, we won't do anything with it for edits
  specimen: Specimen;
  activityDefinition: ActivityDefinition;
  currentUserPractitioner: Practitioner;
  attendingPractitioner: Practitioner;
  location: Location | undefined;
  schedule: Schedule;
  relatedServiceRequests: ServiceRequest[] | undefined;
  existingDiagnosticReport: DiagnosticReport | undefined;
  resultEntryMode: 'initial' | 'edit';
}> => {
  const labOrderResources = (
    await oystehr.fhir.search<
      ServiceRequest | Patient | Encounter | Specimen | Task | Schedule | Location | DiagnosticReport
    >({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: '_id',
          value: serviceRequestId,
        },
        {
          name: '_include',
          value: 'ServiceRequest:encounter',
        },
        {
          name: '_revinclude',
          value: 'Task:based-on',
        },
        {
          name: '_include',
          value: 'ServiceRequest:specimen',
        },
        {
          name: '_include',
          value: 'ServiceRequest:patient',
        },
        { name: '_include:iterate', value: 'Encounter:location' },
        {
          name: '_include:iterate',
          value: 'Encounter:appointment',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:slot',
        },
        {
          name: '_include:iterate',
          value: 'Slot:schedule',
        },
        // Include any related repeat test SRs
        {
          name: '_include:iterate',
          value: 'ServiceRequest:based-on',
        },
        {
          name: '_revinclude:iterate',
          value: 'ServiceRequest:based-on',
        },
        // Include existing diagnostic reports in case results are being updated/corrected
        {
          name: '_revinclude',
          value: 'DiagnosticReport:based-on',
        },
      ],
    })
  ).unbundle();

  console.log('labOrderResources', JSON.stringify(labOrderResources));

  const serviceRequests: ServiceRequest[] = [];
  const patients: Patient[] = [];
  const inputResultTasks: Task[] = []; // IRT tasks
  const specimens: Specimen[] = [];
  const encounters: Encounter[] = [];
  const schedules: Schedule[] = [];
  const locations: Location[] = [];
  const diagnosticReports: DiagnosticReport[] = [];

  labOrderResources.forEach((resource) => {
    if (resource.resourceType === 'ServiceRequest') serviceRequests.push(resource);
    if (resource.resourceType === 'Patient') patients.push(resource);
    if (resource.resourceType === 'Specimen') specimens.push(resource);
    if (resource.resourceType === 'Encounter') encounters.push(resource);
    if (resource.resourceType === 'Schedule') schedules.push(resource);
    if (resource.resourceType === 'Location') locations.push(resource);
    if (
      resource.resourceType === 'Task' &&
      resource.code?.coding?.some((c) => c.code === IN_HOUSE_LAB_TASK.code.inputResultsTask)
    ) {
      inputResultTasks.push(resource);
    }
    if (resource.resourceType === 'DiagnosticReport') {
      diagnosticReports.push(resource);
    }
  });

  const serviceRequest = serviceRequests.find((sr) => sr.id === serviceRequestId);
  let existingDiagnosticReport: DiagnosticReport | undefined;

  let resultEntryMode: 'initial' | 'edit' = 'initial';
  if (serviceRequest?.status === 'completed' && diagnosticReports.length > 0) {
    console.log(
      'result entry mode has been flagged as edit since the service request is completed and a diagnostic report already exists'
    );

    existingDiagnosticReport = diagnosticReports.find((dr) => {
      const statusIsValid = !['entered-in-error', 'cancelled'].includes(dr.status);

      const isBasedOnServiceRequest = dr.basedOn?.some(
        (ref) => ref.reference === `ServiceRequest/${serviceRequest.id}`
      );

      return isBasedOnServiceRequest && statusIsValid;
    });

    if (!existingDiagnosticReport) {
      throw new Error(
        `Something is misconfigured with existing results, we could not find the correct existing diagnostic report for this in-house lab. Related resources: ServiceRequest/${
          serviceRequest.id
        } ${diagnosticReports.map((dr) => `DiagnosticReport/${dr.id}`)}`
      );
    }

    resultEntryMode = 'edit';
  } else {
    console.log(`result entry mode has been flagged as initial, related ServiceRequest/${serviceRequest?.id}`);
  }

  if (!serviceRequest) throw new Error(`service request not found for id ${serviceRequestId}`);
  if (patients.length !== 1) throw new Error('Only one patient should be returned');
  if (encounters.length !== 1) throw new Error('Only one encounter should be returned');
  if (specimens.length !== 1)
    throw new Error(`Only one specimen should be returned - specimen ids: ${specimens.map((s) => s.id)}`);

  let inputResultTask: Task | undefined;

  if (resultEntryMode === 'initial') {
    console.log('These are the inputResultTasks', JSON.stringify(inputResultTasks));
    if (inputResultTasks.length !== 1) {
      console.log('inputResultTasks', inputResultTasks);
      throw new Error(`Found multiple IRT tasks for ServiceRequest/${serviceRequestId}. Expected one`);
    }

    inputResultTask = inputResultTasks[0];

    if (inputResultTask.status === 'completed') {
      console.log(`Task is completed: Task/${inputResultTask.id}`);
      throw new Error('Result has already been entered. Refresh the page to continue.');
    }
    if (inputResultTask.status !== 'ready' && inputResultTask.status !== 'in-progress') {
      console.log(`Task is in unexpected state. Task/${inputResultTask.id} status: ${inputResultTask.status}`);
      throw new Error(`One ready or in-progress IRT task should exist for ServiceRequest/${serviceRequestId}`);
    }
  }

  const relatedServiceRequests =
    serviceRequests.length > 1 ? getRelatedServiceRequests(serviceRequests, serviceRequestId) : undefined;
  console.log('relatedServiceRequests ids ', relatedServiceRequests?.map((sr) => sr.id));

  const patient = patients[0];

  const encounter = encounters[0];
  const attendingPractitionerId = getAttendingPractitionerId(encounter);
  if (!attendingPractitionerId) throw Error('Attending practitioner not found');
  const schedule = schedules[0];
  const location = locations.length ? locations[0] : undefined;

  const { url: adUrl, version } = getUrlAndVersionForADFromServiceRequest(serviceRequest);

  const [currentUserPractitioner, attendingPractitioner, activityDefinitionSearch] = await Promise.all([
    oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: curUserPractitionerId,
    }),
    oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: attendingPractitionerId,
    }),
    // todo there's a bug with _include=ServiceRequest:instantiates-canonical
    // so doing this for now
    oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        {
          name: 'url',
          value: adUrl,
        },
        { name: 'version', value: version },
      ],
    }),
  ]);

  const activityDefinitions = activityDefinitionSearch.unbundle();

  if (activityDefinitions.length !== 1) throw new Error('Only one activity definition should be returned');

  return {
    serviceRequest,
    encounter,
    patient,
    inputResultTask,
    specimen: specimens[0],
    activityDefinition: activityDefinitions[0],
    currentUserPractitioner,
    attendingPractitioner,
    location,
    schedule,
    relatedServiceRequests,
    existingDiagnosticReport,
    resultEntryMode,
  };
};

interface PractitionerConfig {
  id: string;
  name: string | undefined;
}

const makeResultEntryRequests = (
  serviceRequest: ServiceRequest,
  irtTask: Task | undefined, // will only be returned for initial entry, we won't do anything with it for edits
  specimen: Specimen,
  activityDefinition: ActivityDefinition,
  resultsEntryData: ResultEntryInput,
  curUser: PractitionerConfig,
  attendingPractitioner: PractitionerConfig,
  relatedServiceRequests: ServiceRequest[] | undefined,
  existingDiagnosticReport: DiagnosticReport | undefined,
  resultEntryMode: 'initial' | 'edit'
): BatchInputRequest<FhirResource>[] => {
  const requests: BatchInputRequest<FhirResource>[] = [];
  const serviceRequestPatchOperations: Operation[] = [];

  const { provenancePostRequest, provenanceFullUrl } = makeProvenancePostRequest(
    serviceRequest.id || '',
    curUser,
    attendingPractitioner,
    resultEntryMode
  );
  requests.push(provenancePostRequest);

  // we do work in the resource fetch to make sure there is always a input result task ready to be completed when the result entry mode is initial
  if (resultEntryMode === 'initial' && irtTask) {
    serviceRequestPatchOperations.push({
      path: '/status',
      op: 'replace',
      value: 'completed',
    });

    const irtTaskPatchRequest = makeIrtTaskPatchRequest(irtTask, provenanceFullUrl, curUser);
    requests.push(irtTaskPatchRequest);
  }

  const { obsRefs, obsPostRequests, nonNormalResultRecorded, reflexTestTriggered } = makeObservationPostRequests(
    serviceRequest,
    specimen,
    activityDefinition,
    curUser,
    resultsEntryData
  );
  requests.push(...obsPostRequests);

  const diagnosticReportRequest = makeDiagnosticReportRequest(
    serviceRequest,
    activityDefinition,
    obsRefs,
    nonNormalResultRecorded,
    reflexTestTriggered,
    existingDiagnosticReport
  );
  requests.push(diagnosticReportRequest);

  const isReflex = activityDefinitionIsReflexTest(activityDefinition);

  if (isReflex && reflexTestTriggered) {
    throw new Error(
      `this test somehow is both triggering a reflex test and is a reflex test, we are not equipped to handle: ServiceRequest/${serviceRequest.id}`
    );
  }

  if (reflexTestTriggered) {
    console.log(`reflexTestTriggered, we need to add pending reflex test tag to ServiceRequest/${serviceRequest.id}`);
    // if we make it here it would be very odd for this ext.valueString to not be found
    const testName =
      reflexTestTriggered.extension?.find((ext) => ext.url === REFLEX_TEST_TO_RUN_NAME_URL)?.valueString ??
      'reflex test';

    // tagging the service request so that we can validate signing the progress note
    // if a reflex test has been triggered progress note cannot be signed until the reflex test is created and results are inputted
    const serviceRequestTagPatchOps = getPatchOperationsForNewMetaTags(serviceRequest, [
      {
        system: SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_SYSTEM,
        code: SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_CODES.pending,
        display: testName,
      },
    ]);
    serviceRequestPatchOperations.push(...serviceRequestTagPatchOps);
  } else if (isReflex) {
    // need to remove the reflex test pending tag from the parent SR so the user can sign progress note
    console.log(
      'Results are being entered for a reflex test, we need to remove the pending test tag from the parent ServiceRequest, searching for it now'
    );
    const parentServiceRequestId = serviceRequest.basedOn
      ?.find((ref) => ref.reference?.startsWith('ServiceRequest/'))
      ?.reference?.replace('ServiceRequest/', '');
    const parentServiceRequest = relatedServiceRequests?.find((sr) => sr.id === parentServiceRequestId);

    if (parentServiceRequest) {
      console.log(`found a parent test, ServiceRequest/${parentServiceRequest.id}`);
      // remove the reflex-test-tag on the parent test service request
      const parentTestServiceRequestTagPatch: BatchInputRequest<ServiceRequest> = {
        method: 'PATCH',
        url: `ServiceRequest/${parentServiceRequest.id}`,
        operations: [
          getPatchOperationToRemoveMetaTags(parentServiceRequest, [
            {
              system: SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_SYSTEM,
              code: SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_CODES.pending,
            },
          ]),
        ],
      };
      requests.push(parentTestServiceRequestTagPatch);
    }
  }

  if (serviceRequestPatchOperations.length > 0) {
    const serviceRequestPatchRequest: BatchInputPatchRequest<ServiceRequest> = {
      method: 'PATCH',
      url: `ServiceRequest/${serviceRequest.id}`,
      operations: serviceRequestPatchOperations,
    };
    requests.push(serviceRequestPatchRequest);
  }

  return requests;
};

const makeObservationPostRequests = (
  serviceRequest: ServiceRequest,
  specimen: Specimen,
  activityDefinition: ActivityDefinition,
  curUser: PractitionerConfig,
  resultsEntryData: ResultEntryInput
): {
  obsRefs: Reference[];
  obsPostRequests: BatchInputPostRequest<Observation>[];
  nonNormalResultRecorded: NonNormalResult[];
  reflexTestTriggered: Extension | undefined;
} => {
  if (!activityDefinition.code) throw new Error('activityDefinition.code is missing and is required');

  const activityDefContained = activityDefinition.contained;
  if (!activityDefContained) throw new Error('activityDefinition.contained is missing and is required');

  const obsConfig: Observation = {
    resourceType: 'Observation',
    basedOn: [
      {
        reference: `ServiceRequest/${serviceRequest.id}`,
      },
    ],
    encounter: serviceRequest.encounter,
    status: 'final',
    subject: serviceRequest.subject,
    specimen: {
      reference: `Specimen/${specimen.id}`,
    },
    performer: [
      {
        reference: `Practitioner/${curUser.id}`,
        display: curUser.name,
      },
    ],
    code: activityDefinition.code,
  };

  const obsRefs: Reference[] = [];
  const obsPostRequests: BatchInputPostRequest<Observation>[] = [];

  const nonNormalResultRecorded: NonNormalResult[] = [];
  let reflexTestTriggered: Extension | undefined;
  Object.keys(resultsEntryData).forEach((observationDefinitionId) => {
    const entry = resultsEntryData[observationDefinitionId];
    const obsFullUrl = `urn:uuid:${randomUUID()}`;
    const obsDef = getObsDefFromActivityDef(observationDefinitionId, activityDefContained);
    obsRefs.push({
      reference: obsFullUrl,
    });
    const { obsValue, obsInterpretation, nonNormalResult } = formatObsValueAndInterpretation(
      entry,
      obsDef,
      activityDefContained
    );
    if (nonNormalResult) {
      console.log('flagging non-normal result for', activityDefinition.code?.coding?.map((coding) => coding.code));
      nonNormalResultRecorded.push(nonNormalResult);
    }
    const obsFinalConfig: Observation = {
      ...obsConfig,
      ...obsValue,
      ...obsInterpretation,
      extension: [
        {
          url: IN_HOUSE_OBS_DEF_ID_SYSTEM,
          valueString: observationDefinitionId,
        },
      ],
    };

    reflexTestTriggered = checkIfReflexIsTriggered(activityDefinition, obsFinalConfig);

    const request: BatchInputPostRequest<Observation> = {
      method: 'POST',
      fullUrl: obsFullUrl,
      url: '/Observation',
      resource: obsFinalConfig,
    };
    obsPostRequests.push(request);
  });

  return { obsRefs, obsPostRequests, nonNormalResultRecorded, reflexTestTriggered };
};

const getObsDefFromActivityDef = (obsDefId: string, activityDefContained: FhirResource[]): ObservationDefinition => {
  const obsDef = activityDefContained.find(
    (resource) => resource.id === obsDefId && resource.resourceType === 'ObservationDefinition'
  );
  if (!obsDef)
    throw new Error(`activityDefinition.contained does not contain an ObservationDefinition with the id ${obsDefId}`);
  return obsDef as ObservationDefinition;
};

const formatObsValueAndInterpretation = (
  dataEntry: string,
  obsDef: ObservationDefinition,
  activityDefContained: FhirResource[]
): {
  obsValue: { valueQuantity: Quantity } | { valueString: string };
  obsInterpretation: { interpretation?: CodeableConcept[] };
  nonNormalResult: NonNormalResult | undefined;
} => {
  if (!obsDef.permittedDataType) {
    console.error('Obs def does not have a permittedDataType');
    throw new Error('No permittedDataType found on ObsDef');
  }
  if (obsDef.permittedDataType.includes('Quantity')) {
    const floatVal = parseFloat(dataEntry);
    const obsValue = {
      valueQuantity: {
        value: floatVal,
      },
    };
    const range = extractQuantityRange(obsDef).normalRange;
    const { interpretation: interpretationCodeableConcept, nonNormalResult } = determineQuantInterpretation(
      floatVal,
      range
    );
    const obsInterpretation = {
      interpretation: [interpretationCodeableConcept],
    };
    return { obsValue, obsInterpretation, nonNormalResult };
  }

  if (obsDef.permittedDataType.includes('CodeableConcept')) {
    const obsValue = {
      valueString: dataEntry,
    };
    const filteredContained = activityDefContained.filter(
      (resource) => resource.resourceType === 'ObservationDefinition' || resource.resourceType === 'ValueSet'
    ) as (ObservationDefinition | ValueSet)[];
    const abnormalValues = extractAbnormalValueSetValues(obsDef, filteredContained);
    const isNeutral = abnormalValues.length === 0;
    console.log('isNeutral:', isNeutral);
    const { interpretation: interpretationCodeableConcept, nonNormalResult } = determineCodeableConceptInterpretation(
      dataEntry,
      abnormalValues
    );
    const obsInterpretation = {
      interpretation: [interpretationCodeableConcept],
    };

    return { obsValue, obsInterpretation, nonNormalResult: isNeutral ? NonNormalResult.Neutral : nonNormalResult };
  }

  if (obsDef.permittedDataType.includes('string')) {
    const obsValue = {
      valueString: dataEntry,
    };
    // labs todo: in the future we can determine if we want to check string types for abnormality
    const obsInterpretation = {
      interpretation: [NORMAL_OBSERVATION_INTERPRETATION],
    };
    return { obsValue, obsInterpretation, nonNormalResult: undefined };
  }
  throw new Error('Cannot format Obs value and interpretation. Unrecognized obsDef.permittedDataType');
};

const determineQuantInterpretation = (
  entry: number,
  range: {
    low: number;
    high: number;
    unit: string;
    precision?: number;
  }
): { interpretation: CodeableConcept; nonNormalResult?: NonNormalResult } => {
  if (entry > range.high || entry < range.low) {
    return { interpretation: ABNORMAL_OBSERVATION_INTERPRETATION, nonNormalResult: NonNormalResult.Abnormal };
  } else {
    return { interpretation: NORMAL_OBSERVATION_INTERPRETATION };
  }
};

// todo should also validate that the value passed is contained within normal values
const determineCodeableConceptInterpretation = (
  value: string,
  abnormalValues: LabComponentValueSetConfig[]
): { interpretation: CodeableConcept; nonNormalResult?: NonNormalResult } => {
  if (value === IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG.valueCode) {
    return { interpretation: INDETERMINATE_OBSERVATION_INTERPRETATION, nonNormalResult: NonNormalResult.Inconclusive };
  } else {
    return abnormalValues.map((val) => val.code).includes(value)
      ? { interpretation: ABNORMAL_OBSERVATION_INTERPRETATION, nonNormalResult: NonNormalResult.Abnormal }
      : { interpretation: NORMAL_OBSERVATION_INTERPRETATION };
  }
};

const makeDiagnosticReportRequest = (
  serviceRequest: ServiceRequest,
  activityDefinition: ActivityDefinition,
  obsRefs: Reference[],
  nonNormalResultRecorded: NonNormalResult[],
  reflexTestTriggered: Extension | undefined,
  existingDiagnosticReport: DiagnosticReport | undefined
): BatchInputPostRequest<DiagnosticReport> | BatchInputPutRequest<DiagnosticReport> => {
  if (!activityDefinition.code) throw new Error('activityDefinition.code is missing and is required');

  const diagnosticReportConfig: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    basedOn: [{ reference: `ServiceRequest/${serviceRequest.id}` }],
    status: 'final',
    category: [{ coding: [IN_HOUSE_DIAGNOSTIC_REPORT_CATEGORY_CONFIG] }],
    code: activityDefinition.code,
    subject: serviceRequest.subject,
    encounter: serviceRequest.encounter,
    specimen: serviceRequest.specimen,
    result: obsRefs,
  };

  const tags = [];
  const extension: Extension[] = [];

  if (nonNormalResultRecorded.length) {
    console.log('nonNormalResultRecorded', nonNormalResultRecorded);
    if (nonNormalResultRecorded.includes(NonNormalResult.Abnormal)) {
      tags.push(ABNORMAL_RESULT_DR_TAG);
    }
    if (nonNormalResultRecorded.includes(NonNormalResult.Inconclusive)) {
      tags.push(INCONCLUSIVE_RESULT_DR_TAG);
    }
    if (nonNormalResultRecorded.includes(NonNormalResult.Neutral)) {
      tags.push(NEUTRAL_RESULT_DR_TAG);
    }
  } else {
    console.log('all recorded results are reported normal');
  }

  if (reflexTestTriggered) {
    console.log('adding reflexTestTriggered extension to diagnostic report config');
    extension.push(reflexTestTriggered);
  }

  if (tags.length) {
    console.log('adding result tags to dr, count: ', tags.length);
    diagnosticReportConfig.meta = {
      tag: tags,
    };
  }

  if (extension.length) {
    console.log('adding extension to dr, count: ', extension.length);
    diagnosticReportConfig.extension = extension;
  }

  if (existingDiagnosticReport && existingDiagnosticReport.id) {
    const updatedDiagnosticReport = {
      ...existingDiagnosticReport,
      ...diagnosticReportConfig,
    };

    const diagnosticReportPutRequest: BatchInputPutRequest<DiagnosticReport> = {
      method: 'PUT',
      url: `DiagnosticReport/${existingDiagnosticReport.id}`,
      resource: updatedDiagnosticReport,
    };

    return diagnosticReportPutRequest;
  } else {
    const diagnosticReportPostRequest: BatchInputPostRequest<DiagnosticReport> = {
      method: 'POST',
      url: '/DiagnosticReport',
      resource: diagnosticReportConfig,
    };

    return diagnosticReportPostRequest;
  }
};

const makeProvenancePostRequest = (
  serviceRequestId: string,
  curUser: PractitionerConfig,
  attendingPractitioner: PractitionerConfig,
  resultEntryMode: 'initial' | 'edit'
): { provenancePostRequest: BatchInputPostRequest<Provenance>; provenanceFullUrl: string } => {
  const provenanceFullUrl = `urn:uuid:${randomUUID()}`;
  const provenanceConfig: Provenance = {
    resourceType: 'Provenance',
    target: [
      {
        reference: `ServiceRequest/${serviceRequestId}`,
      },
    ],
    activity: {
      coding: [
        resultEntryMode === 'initial'
          ? PROVENANCE_ACTIVITY_CODING_ENTITY.inputResults
          : PROVENANCE_ACTIVITY_CODING_ENTITY.editResults,
      ],
    },
    recorded: DateTime.now().toISO(),
    agent: [
      {
        who: { reference: `Practitioner/${curUser.id}`, display: curUser.name },
        onBehalfOf: {
          reference: `Practitioner/${attendingPractitioner.id}`,
          display: attendingPractitioner.name,
        },
      },
    ],
  };
  const provenancePostRequest: BatchInputPostRequest<Provenance> = {
    method: 'POST',
    fullUrl: provenanceFullUrl,
    url: '/Provenance',
    resource: provenanceConfig,
  };
  return { provenancePostRequest, provenanceFullUrl };
};

const makeIrtTaskPatchRequest = (
  irtTask: Task,
  provenanceFullUrl: string,
  curUser: PractitionerConfig
): BatchInputPatchRequest<Task> => {
  const provRef = {
    reference: provenanceFullUrl,
  };

  const operations: Operation[] = [
    {
      path: '/relevantHistory',
      op: irtTask.relevantHistory ? 'replace' : 'add',
      value: irtTask.relevantHistory ? [...irtTask.relevantHistory, provRef] : [provRef],
    },
    {
      path: '/status',
      op: 'replace',
      value: 'completed',
    },
  ];

  if (!irtTask.owner) {
    operations.push({
      path: '/owner',
      op: 'add',
      value: createOwnerReference(curUser.id, curUser.name ?? ''),
    });
  }

  const irtTaskPatchRequest: BatchInputPatchRequest<Task> = {
    method: 'PATCH',
    url: `Task/${irtTask.id}`,
    operations: operations,
  };
  return irtTaskPatchRequest;
};
