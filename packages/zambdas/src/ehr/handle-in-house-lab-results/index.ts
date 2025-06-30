import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Operation } from 'fast-json-patch';
import {
  ActivityDefinition,
  CodeableConcept,
  DiagnosticReport,
  Encounter,
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
  extractAbnormalValueSetValues,
  extractQuantityRange,
  getFullestAvailableName,
  getSecret,
  HandleInHouseLabResultsZambdaOutput,
  IN_HOUSE_DIAGNOSTIC_REPORT_CATEGORY_CONFIG,
  IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG,
  IN_HOUSE_LAB_TASK,
  IN_HOUSE_OBS_DEF_ID_SYSTEM,
  INDETERMINATE_OBSERVATION_INTERPRETATION,
  LabComponentValueSetConfig,
  NORMAL_OBSERVATION_INTERPRETATION,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  ResultEntryInput,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
  topLevelCatch,
  ZambdaInput,
} from '../../shared';
import { createInHouseLabResultPDF } from '../../shared/pdf/labs-results-form-pdf';
import {
  getAttendingPractionerId,
  getServiceRequestsRelatedViaRepeat,
  getUrlAndVersionForADFromServiceRequest,
} from '../shared/inhouse-labs';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
      inputRequestTask,
      specimen,
      activityDefinition,
      currentUserPractitioner,
      attendingPractitioner,
      schedule,
      location,
      serviceRequestsRelatedViaRepeat,
    } = await getInHouseLabResultResources(serviceRequestId, curUserPractitionerId, oystehr);

    const currentUserPractitionerName = getFullestAvailableName(currentUserPractitioner);
    const attendingPractitionerName = getFullestAvailableName(attendingPractitioner);

    const requests = makeResultEntryRequests(
      serviceRequest,
      inputRequestTask,
      specimen,
      activityDefinition,
      resultsEntryData,
      { id: curUserPractitionerId, name: currentUserPractitionerName },
      { id: attendingPractitioner.id || '', name: attendingPractitionerName }
    );

    const res = await oystehr.fhir.transaction({ requests });
    console.log('check the res', JSON.stringify(res));

    let diagnosticReport: DiagnosticReport | undefined;
    let updatedInputResultTask: Task | undefined;
    const observations: Observation[] = [];
    res.entry?.forEach((entry) => {
      if (entry.resource?.resourceType === 'DiagnosticReport') {
        diagnosticReport = entry.resource as DiagnosticReport;
      }
      if (entry.resource?.resourceType === 'Task') {
        const task = entry.resource as Task;
        if (task.code?.coding?.some((c) => c.code === IN_HOUSE_LAB_TASK.code.inputResultsTask)) {
          updatedInputResultTask = task;
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
    if (!updatedInputResultTask)
      throw new Error(
        `There was an issue updating and/or parsing the input result task for this service request: ${serviceRequest.id}`
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
        updatedInputResultTask,
        observations,
        diagnosticReport,
        secrets,
        m2mToken,
        activityDefinition,
        serviceRequestsRelatedViaRepeat,
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
    await topLevelCatch('handle-in-house-lab-results', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error processing request: ${error.message || error}`,
      }),
    };
  }
};

// todo better errors
const getInHouseLabResultResources = async (
  serviceRequestId: string,
  curUserPractitionerId: string,
  oystehr: Oystehr
): Promise<{
  serviceRequest: ServiceRequest;
  encounter: Encounter;
  patient: Patient;
  inputRequestTask: Task;
  specimen: Specimen;
  activityDefinition: ActivityDefinition;
  currentUserPractitioner: Practitioner;
  attendingPractitioner: Practitioner;
  location: Location | undefined;
  schedule: Schedule;
  serviceRequestsRelatedViaRepeat: ServiceRequest[] | undefined;
}> => {
  const labOrderResources = (
    await oystehr.fhir.search<ServiceRequest | Patient | Encounter | Specimen | Task | Schedule | Location>({
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
        {
          name: '_revinclude',
          value: 'Task:based-on',
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
      ],
    })
  ).unbundle();

  console.log('labOrderResources', JSON.stringify(labOrderResources));

  const serviceRequests: ServiceRequest[] = [];
  const patients: Patient[] = [];
  const inputRequestTasks: Task[] = []; // IRT tasks
  const specimens: Specimen[] = [];
  const encounters: Encounter[] = [];
  const schedules: Schedule[] = [];
  const locations: Location[] = [];

  labOrderResources.forEach((resource) => {
    if (resource.resourceType === 'ServiceRequest') serviceRequests.push(resource);
    if (resource.resourceType === 'Patient') patients.push(resource);
    if (resource.resourceType === 'Specimen') specimens.push(resource);
    if (resource.resourceType === 'Encounter') encounters.push(resource);
    if (resource.resourceType === 'Schedule') schedules.push(resource);
    if (resource.resourceType === 'Location') locations.push(resource);
    if (
      resource.resourceType === 'Task' &&
      resource.status === 'ready' &&
      resource.code?.coding?.some((c) => c.code === IN_HOUSE_LAB_TASK.code.inputResultsTask)
    ) {
      inputRequestTasks.push(resource);
    }
  });

  const serviceRequest = serviceRequests.find((sr) => sr.id === serviceRequestId);

  if (!serviceRequest) throw new Error(`service request not found for id ${serviceRequestId}`);
  if (patients.length !== 1) throw new Error('Only one patient should be returned');
  if (encounters.length !== 1) throw new Error('Only one encounter should be returned');
  if (specimens.length !== 1)
    throw new Error(`Only one specimen should be returned - specimen ids: ${specimens.map((s) => s.id)}`);
  if (inputRequestTasks.length !== 1) {
    console.log('inputRequestTasks', inputRequestTasks);
    throw new Error(`Only one ready IRT task should exist for ServiceRequest/${serviceRequestId}`);
  }

  const serviceRequestsRelatedViaRepeat =
    serviceRequests.length > 1 ? getServiceRequestsRelatedViaRepeat(serviceRequests, serviceRequestId) : undefined;
  console.log('serviceRequestsRelatedViaRepeat ids ', serviceRequestsRelatedViaRepeat?.map((sr) => sr.id));

  const patient = patients[0];

  const encounter = encounters[0];
  const attendingPractitionerId = getAttendingPractionerId(encounter);
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
    inputRequestTask: inputRequestTasks[0],
    specimen: specimens[0],
    activityDefinition: activityDefinitions[0],
    currentUserPractitioner,
    attendingPractitioner,
    location,
    schedule,
    serviceRequestsRelatedViaRepeat,
  };
};

interface PractitionerConfig {
  id: string;
  name: string | undefined;
}

const makeResultEntryRequests = (
  serviceRequest: ServiceRequest,
  irtTask: Task,
  specimen: Specimen,
  activityDefinition: ActivityDefinition,
  resultsEntryData: ResultEntryInput,
  curUser: PractitionerConfig,
  attendingPractitioner: PractitionerConfig
): BatchInputRequest<FhirResource>[] => {
  const { provenancePostRequest, provenanceFullUrl } = makeProvenancePostRequest(
    serviceRequest.id || '',
    curUser,
    attendingPractitioner
  );

  const irtTaskPatchRequest = makeIrtTaskPatchRequest(irtTask, provenanceFullUrl);

  const serviceRequestPatchRequest: BatchInputPatchRequest<ServiceRequest> = {
    method: 'PATCH',
    url: `ServiceRequest/${serviceRequest.id}`,
    operations: [
      {
        path: '/status',
        op: 'replace',
        value: 'completed',
      },
    ],
  };

  const { obsRefs, obsPostRequests } = makeObservationPostRequests(
    serviceRequest,
    specimen,
    activityDefinition,
    curUser,
    resultsEntryData
  );

  const diagnosticReportPostRequest = makeDiagnosticReportPostRequest(serviceRequest, activityDefinition, obsRefs);

  return [
    provenancePostRequest,
    irtTaskPatchRequest,
    serviceRequestPatchRequest,
    ...obsPostRequests,
    diagnosticReportPostRequest,
  ];
};

// todo better errors
const makeObservationPostRequests = (
  serviceRequest: ServiceRequest,
  specimen: Specimen,
  activityDefinition: ActivityDefinition,
  curUser: PractitionerConfig,
  resultsEntryData: ResultEntryInput
): { obsRefs: Reference[]; obsPostRequests: BatchInputPostRequest<Observation>[] } => {
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

  Object.keys(resultsEntryData).forEach((observationDefinitionId) => {
    const entry = resultsEntryData[observationDefinitionId];
    const obsFullUrl = `urn:uuid:${randomUUID()}`;
    const obsDef = getObsDefFromActivityDef(observationDefinitionId, activityDefContained);
    obsRefs.push({
      reference: obsFullUrl,
    });
    const { obsValue, obsInterpretation } = formatObsValueAndInterpretation(entry, obsDef, activityDefContained);
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
    const request: BatchInputPostRequest<Observation> = {
      method: 'POST',
      fullUrl: obsFullUrl,
      url: '/Observation',
      resource: obsFinalConfig,
    };
    obsPostRequests.push(request);
  });

  return { obsRefs, obsPostRequests };
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
} => {
  if (obsDef.permittedDataType?.includes('Quantity')) {
    const floatVal = parseFloat(dataEntry);
    const obsValue = {
      valueQuantity: {
        value: floatVal,
      },
    };
    const range = extractQuantityRange(obsDef).normalRange;
    const interpretationCodeableConcept = determineQuantInterpretation(floatVal, range);
    const obsInterpretation = {
      interpretation: [interpretationCodeableConcept],
    };
    return { obsValue, obsInterpretation };
  }

  if (obsDef.permittedDataType?.includes('CodeableConcept')) {
    const obsValue = {
      valueString: dataEntry,
    };
    const filteredContained = activityDefContained.filter(
      (resource) => resource.resourceType === 'ObservationDefinition' || resource.resourceType === 'ValueSet'
    ) as (ObservationDefinition | ValueSet)[];
    const abnormalValues = extractAbnormalValueSetValues(obsDef, filteredContained);
    const interpretationCodeableConcept = deteremineCodeableConceptInterpretation(dataEntry, abnormalValues);
    const obsInterpretation = {
      interpretation: [interpretationCodeableConcept],
    };

    return { obsValue, obsInterpretation };
  }

  throw new Error('obsDef.permittedDataType should be Quantity or CodeableConcept');
};

const determineQuantInterpretation = (
  entry: number,
  range: {
    low: number;
    high: number;
    unit: string;
    precision?: number;
  }
): CodeableConcept => {
  if (entry > range.high || entry < range.low) {
    return ABNORMAL_OBSERVATION_INTERPRETATION;
  } else {
    return NORMAL_OBSERVATION_INTERPRETATION;
  }
};

// todo should also validate that the value passed is contained within normal values
const deteremineCodeableConceptInterpretation = (
  value: string,
  abnormalValues: LabComponentValueSetConfig[]
): CodeableConcept => {
  if (value === IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG.valueCode) {
    return INDETERMINATE_OBSERVATION_INTERPRETATION;
  } else {
    return abnormalValues.map((val) => val.code).includes(value)
      ? ABNORMAL_OBSERVATION_INTERPRETATION
      : NORMAL_OBSERVATION_INTERPRETATION;
  }
};

const makeDiagnosticReportPostRequest = (
  serviceRequest: ServiceRequest,
  activityDefinition: ActivityDefinition,
  obsRefs: Reference[]
): BatchInputPostRequest<DiagnosticReport> => {
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

  const diagnosticReportPostRequest: BatchInputPostRequest<DiagnosticReport> = {
    method: 'POST',
    url: '/DiagnosticReport',
    resource: diagnosticReportConfig,
  };

  return diagnosticReportPostRequest;
};

const makeProvenancePostRequest = (
  serviceRequestId: string,
  curUser: PractitionerConfig,
  attendingPractitioner: PractitionerConfig
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
      coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.inputResults],
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

const makeIrtTaskPatchRequest = (irtTask: Task, provenanceFullUrl: string): BatchInputPatchRequest<Task> => {
  const provRef = {
    reference: provenanceFullUrl,
  };
  const relavantHistOp: Operation = {
    path: '/relevantHistory',
    op: irtTask.relevantHistory ? 'replace' : 'add',
    value: irtTask.relevantHistory ? [...irtTask.relevantHistory, provRef] : [provRef],
  };

  const irtTaskPatchRequest: BatchInputPatchRequest<Task> = {
    method: 'PATCH',
    url: `Task/${irtTask.id}`,
    operations: [
      {
        path: '/status',
        op: 'replace',
        value: 'completed',
      },
      relavantHistOp,
    ],
  };
  return irtTaskPatchRequest;
};
