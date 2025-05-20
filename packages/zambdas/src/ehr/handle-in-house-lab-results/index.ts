import { APIGatewayProxyResult } from 'aws-lambda';
import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import {
  ZambdaInput,
  topLevelCatch,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import {
  IN_HOUSE_LAB_TASK,
  ResultEntryInput,
  extractQuantityRange,
  ABNORMAL_OBSERVATION_INTERPRETATION,
  NORMAL_OBSERVATION_INTERPRETATION,
  extractAbnormalValueSetValues,
  DIAGNOSTIC_REPORT_CATEGORY_CONFIG,
  IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG,
} from 'utils';
import {
  ServiceRequest,
  Task,
  Specimen,
  DiagnosticReport,
  Observation,
  ActivityDefinition,
  Reference,
  ObservationDefinition,
  Quantity,
  CodeableConcept,
  FhirResource,
} from 'fhir/r4b';
import { randomUUID } from 'crypto';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`handle-in-house-lab-results started, input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { serviceRequestId, data: resultsEntryData, secrets, userToken } = validateRequestParameters(input);
    console.log('validateRequestParameters success');

    console.log('Getting token');
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    console.log('token', m2mtoken);

    const oystehr = createOystehrClient(m2mtoken, secrets);
    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    const curUserPractitionerId = await getMyPractitionerId(oystehrCurrentUser);

    const {
      serviceRequest,
      inputRequestTask: irtTask,
      specimen,
      activityDefinition,
    } = await getResources(serviceRequestId, oystehr);

    const requests = makeResultEntryRequests(
      serviceRequest,
      irtTask,
      specimen,
      activityDefinition,
      curUserPractitionerId,
      resultsEntryData
    );

    // console.log('check whats going on here!', JSON.stringify(requests));

    await oystehr.fhir.transaction({ requests });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully processed in-house lab results.',
      }),
    };
  } catch (error: any) {
    console.error('Error handling in-house lab results:', error);
    await topLevelCatch('handle-in-house-lab-results', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error processing request: ${error.message || error}`,
      }),
    };
  }
};

// todo better errors
const getResources = async (
  serviceRequestId: string,
  oystehr: Oystehr
): Promise<{
  serviceRequest: ServiceRequest;
  inputRequestTask: Task;
  specimen: Specimen;
  activityDefinition: ActivityDefinition;
}> => {
  const labOrderResources = (
    await oystehr.fhir.search<ServiceRequest | Specimen | Task>({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: '_id',
          value: serviceRequestId,
        },
        {
          name: '_revinclude',
          value: 'Task:based-on',
        },
        {
          name: '_include',
          value: 'ServiceRequest:specimen',
        },
      ],
    })
  ).unbundle();

  console.log('labOrderResources', JSON.stringify(labOrderResources));

  const serviceRequests: ServiceRequest[] = [];
  const inputRequestTasks: Task[] = []; // IRT tasks
  const specimens: Specimen[] = [];

  labOrderResources.forEach((resource) => {
    if (resource.resourceType === 'ServiceRequest') serviceRequests.push(resource);
    if (resource.resourceType === 'Specimen') specimens.push(resource);
    if (
      resource.resourceType === 'Task' &&
      resource.status === 'ready' &&
      resource.code?.coding?.some((c) => c.code === IN_HOUSE_LAB_TASK.code.inputResultsTask)
    ) {
      inputRequestTasks.push(resource);
    }
  });

  if (serviceRequests.length !== 1) throw new Error('Only one service request should be returned');
  if (specimens.length !== 1) throw new Error('Only one specimen should be returned');
  if (inputRequestTasks.length !== 1)
    throw new Error(`Only one ready IRT task should exist for ServiceRequest/${serviceRequestId}`);

  const serviceRequest = serviceRequests[0];

  // todo there's a bug with _include=ServiceRequest:instantiates-canonical
  // so doing this for now
  const activityDefinitionSearch = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        {
          name: 'url',
          value: serviceRequest.instantiatesCanonical?.join(',') || '',
        },
        {
          name: 'status',
          value: 'active',
        },
      ],
    })
  ).unbundle();
  if (activityDefinitionSearch.length !== 1) throw new Error('Only one active activity definition should be returned');

  return {
    serviceRequest,
    inputRequestTask: inputRequestTasks[0],
    specimen: specimens[0],
    activityDefinition: activityDefinitionSearch[0],
  };
};

const makeResultEntryRequests = (
  serviceRequest: ServiceRequest,
  irtTask: Task,
  specimen: Specimen,
  activityDefinition: ActivityDefinition,
  curUserPractitionerId: string,
  resultsEntryData: ResultEntryInput
): BatchInputRequest<FhirResource>[] => {
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
  const irtTaskPatchRequest: BatchInputPatchRequest<Task> = {
    method: 'PATCH',
    url: `Task/${irtTask.id}`,
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
    curUserPractitionerId,
    resultsEntryData
  );
  const diagnosticReportPostRequest = makeDiagnosticReportPostRequest(serviceRequest, activityDefinition, obsRefs);

  return [serviceRequestPatchRequest, irtTaskPatchRequest, ...obsPostRequests, diagnosticReportPostRequest];
};

// todo better errors
const makeObservationPostRequests = (
  serviceRequest: ServiceRequest,
  specimen: Specimen,
  activityDefinition: ActivityDefinition,
  curUserPractitionerId: string,
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
        reference: `Practitioner/${curUserPractitionerId}`,
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
    const interpretationCodeableConcept = extractQuantInterpretationCodingVals(floatVal, range);
    const obsInterpretation = {
      interpretation: [interpretationCodeableConcept],
    };
    return { obsValue, obsInterpretation };
  }

  if (obsDef.permittedDataType?.includes('CodeableConcept')) {
    const obsValue = {
      valueString: dataEntry,
    };

    let obsInterpretation = {};
    if (dataEntry !== IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG.valueCode) {
      console.log('wut?', dataEntry, IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG.valueCode);
      const filteredContained = activityDefContained.filter(
        (resource) => resource.resourceType === 'ObservationDefinition' || resource.resourceType === 'ValueSet'
      );
      const abonormalValues = extractAbnormalValueSetValues(obsDef, filteredContained);
      const interpretationCodeableConcept = abonormalValues.includes(dataEntry)
        ? ABNORMAL_OBSERVATION_INTERPRETATION
        : NORMAL_OBSERVATION_INTERPRETATION;
      obsInterpretation = {
        interpretation: [interpretationCodeableConcept],
      };
    }

    return { obsValue, obsInterpretation };
  }

  throw new Error('obsDef.permittedDataType should be Quantity or CodeableConcept');
};

const extractQuantInterpretationCodingVals = (
  entry: number,
  range: {
    low: number;
    high: number;
    unit: string;
    precision?: number;
  }
): CodeableConcept => {
  if (entry >= range.high && entry <= range.low) {
    return ABNORMAL_OBSERVATION_INTERPRETATION;
  } else {
    return NORMAL_OBSERVATION_INTERPRETATION;
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
    category: [{ coding: [DIAGNOSTIC_REPORT_CATEGORY_CONFIG] }],
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
