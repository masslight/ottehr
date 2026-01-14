import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { DiagnosticReport, Encounter, FhirResource, Patient, Practitioner, ServiceRequest, Task } from 'fhir/r4b';
import { ImagingStudy as ImagingStudyR5 } from 'fhir/r5';
import { DateTime } from 'luxon';
import {
  ACCESSION_NUMBER_CODE_SYSTEM,
  ADVAPACS_FHIR_BASE_URL,
  ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM,
  createOurDiagnosticReport,
  getFullestAvailableName,
  getSecret,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM_ACCESSION_NUMBER,
  ORDER_TYPE_CODE_SYSTEM,
  RADIOLOGY_TASK,
  Secrets,
  SecretsKeys,
  SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { createTask } from '../../../shared/tasks';
import { validateInput, validateSecrets } from './validation';

// Types
export interface PacsWebhookBody {
  body: unknown;
}

export interface ValidatedInput {
  resource: ServiceRequest | DiagnosticReport | ImagingStudyR5;
}

interface HandleDrAdditionalResources {
  serviceRequest: ServiceRequest;
  patient: Patient;
  encounter: Encounter;
  requestingProvider: Practitioner;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'radiology-pacs-webhook';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Received input body: ', JSON.stringify(unsafeInput.body, null, 2));

    const secrets = validateSecrets(unsafeInput.secrets);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const validatedInput = await validateInput(unsafeInput);

    await accessCheck(unsafeInput.headers, secrets);

    await performEffect(validatedInput, oystehr, secrets);

    return {
      statusCode: 200,
      body: JSON.stringify({}),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, unsafeInput.secrets));
  }
});

const accessCheck = async (headers: any, secrets: Secrets): Promise<void> => {
  if (headers == null || !headers.Authorization) {
    throw new Error('Unauthorized');
  }

  if (headers.Authorization.split('Bearer ')[1] !== getSecret(SecretsKeys.ADVAPACS_WEBHOOK_SECRET, secrets)) {
    throw new Error('Forbidden');
  }
};

const performEffect = async (validatedInput: ValidatedInput, oystehr: Oystehr, secrets: Secrets): Promise<void> => {
  const { resource } = validatedInput;

  if (resource.id == null) {
    throw new Error('Resource ID is required');
  }

  if (resource.resourceType === 'ServiceRequest') {
    await handleServiceRequest(resource as ServiceRequest, oystehr);
  } else if (resource.resourceType === 'DiagnosticReport') {
    await handleDiagnosticReport(resource as DiagnosticReport, oystehr, secrets);
  } else if (resource.resourceType === 'ImagingStudy') {
    await handleImagingStudy(resource as ImagingStudyR5, oystehr, secrets);
  } else {
    throw new Error('Unexpected resource type in performEffect');
  }
};

const handleServiceRequest = async (advaPacsServiceRequest: ServiceRequest, oystehr: Oystehr): Promise<void> => {
  console.log('processing ServiceRequest');
  const accessionNumber = advaPacsServiceRequest.identifier?.find((i) => {
    return (
      i.type?.coding?.[0].system === HL7_IDENTIFIER_TYPE_CODE_SYSTEM &&
      i.type?.coding?.[0].code === HL7_IDENTIFIER_TYPE_CODE_SYSTEM_ACCESSION_NUMBER &&
      i.system === ACCESSION_NUMBER_CODE_SYSTEM
    );
  })?.value;
  if (accessionNumber == null) {
    throw new Error('Accession number is required');
  }

  const srResults = (
    await oystehr.fhir.search<ServiceRequest>({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: '_tag',
          value: `${ORDER_TYPE_CODE_SYSTEM}|radiology`,
        },
        {
          name: 'identifier',
          // TODO can we include also the type.coding.system & code to be super exact here?
          value: `${ACCESSION_NUMBER_CODE_SYSTEM}|${accessionNumber}`,
        },
      ],
    })
  ).unbundle();

  if (srResults.length === 0) {
    console.log('No matching ServiceRequest found in Oystehr. Doing nothing for accession number: ', accessionNumber);
    return;
    // throw new Error('No ServiceRequest found with the given accession number');
  }

  if (srResults.length > 1) {
    throw new Error('Multiple ServiceRequests found with the given accession number');
  }

  const srToUpdate = srResults[0];
  console.log('Updating our ServiceRequest with ID: ', srToUpdate.id);

  if (srToUpdate.id == null) {
    throw new Error('ServiceRequest ID is required');
  }

  const operations: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: advaPacsServiceRequest.status,
    },
  ];

  // The idea is that the first time we get a ServiceRequest in the completed state, that should be the time that the order was performed.
  if (advaPacsServiceRequest.status === 'completed') {
    if (
      srToUpdate.status !== 'completed' &&
      srToUpdate.extension?.find((e) => e.url === SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL) == null
    ) {
      operations.push({
        op: 'add',
        path: '/extension/-',
        value: {
          url: SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL,
          valueDateTime: DateTime.now().toISO(),
        },
      });
    }
  }

  // TODO make a good plan for practitioner sync
  // operations.push({
  //   op: 'add',
  //   path: '/performer',
  //   value: resource.performer,
  // });

  const patchResponse = await oystehr.fhir.patch<ServiceRequest>({
    resourceType: 'ServiceRequest',
    id: srToUpdate.id,
    operations,
  });
  console.log('Patch succeeded: ', JSON.stringify(patchResponse, null, 2));
};

const handleDiagnosticReport = async (
  advaPacsDiagnosticReport: DiagnosticReport,
  oystehr: Oystehr,
  secrets: Secrets
): Promise<void> => {
  console.log('processing DiagnosticReport');
  // First we want to figure out if we need to create or update, so we search for the DR in our FHIR store
  const drSearchResults = (
    await oystehr.fhir.search<DiagnosticReport | ServiceRequest | Patient | Encounter | Practitioner>({
      resourceType: 'DiagnosticReport',
      params: [
        {
          name: 'identifier',
          // TODO can we include also the type.coding.system & code to be super exact here?
          value: `${ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM}|${advaPacsDiagnosticReport.id}`,
        },
        {
          name: '_include',
          value: 'DiagnosticReport:based-on', // service request
        },
        {
          name: '_include',
          value: 'DiagnosticReport:subject', // patient
        },
        {
          name: '_include:iterate',
          value: 'ServiceRequest:encounter',
        },
        {
          name: '_include:iterate',
          value: 'ServiceRequest:requester',
        },
      ],
    })
  ).unbundle();

  const { diagnosticReports, serviceRequests, patients, encounters, practitioners } = drSearchResults.reduce(
    (
      acc: {
        diagnosticReports: DiagnosticReport[];
        serviceRequests: ServiceRequest[];
        patients: Patient[];
        encounters: Encounter[];
        practitioners: Practitioner[];
      },
      resource
    ) => {
      if (resource.resourceType === 'DiagnosticReport') acc.diagnosticReports.push(resource);
      if (resource.resourceType === 'ServiceRequest') acc.serviceRequests.push(resource);
      if (resource.resourceType === 'Patient') acc.patients.push(resource);
      if (resource.resourceType === 'Encounter') acc.encounters.push(resource);
      if (resource.resourceType === 'Practitioner') acc.practitioners.push(resource);
      return acc;
    },
    { diagnosticReports: [], serviceRequests: [], patients: [], encounters: [], practitioners: [] }
  );

  if (diagnosticReports.length > 1) {
    throw new Error('Multiple DiagnosticReports found with the given ID');
  } else if (diagnosticReports.length === 1) {
    const drToUpdate = diagnosticReports[0];
    if (drToUpdate.id == null) {
      throw new Error('DiagnosticReport ID is required');
    }
    const additionalResources = validateAdditionalResources(
      drToUpdate,
      serviceRequests,
      patients,
      encounters,
      practitioners
    );
    await handleUpdateDiagnosticReport(advaPacsDiagnosticReport, drToUpdate, additionalResources, oystehr);
  } else if (drSearchResults.length === 0) {
    await handleCreateDiagnosticReport(advaPacsDiagnosticReport, oystehr, secrets);
  }
};

const handleCreateDiagnosticReport = async (
  advaPacsDiagnosticReport: DiagnosticReport,
  oystehr: Oystehr,
  secrets: Secrets
): Promise<void> => {
  console.log('Processing DiagnosticReport create');
  // Now look up the SR via DR.basedOn, so we can create our own DR with our own SR basedOn
  const pacsServiceRequestRelativeReference = advaPacsDiagnosticReport.basedOn?.[0]?.reference;
  if (pacsServiceRequestRelativeReference == null) {
    throw new Error('The DiagnosticReport was not associated with any ServiceRequest');
  }

  const pacsServiceRequest = await getAdvaPacsServiceRequestByID(pacsServiceRequestRelativeReference, secrets);
  console.log('Found PACS ServiceRequest: ', pacsServiceRequest);
  const pacsServiceRequestAccessionNumber = pacsServiceRequest.identifier?.find(
    (i) => i.system === ACCESSION_NUMBER_CODE_SYSTEM
  )?.value;
  if (pacsServiceRequestAccessionNumber == null) {
    throw new Error('The ServiceRequest was not associated with any accession number');
  }
  const ourServiceRequest = await getOurServiceRequestByAccessionNumber(pacsServiceRequestAccessionNumber, oystehr);
  console.log('Found our ServiceRequest: ', pacsServiceRequest);
  await createOurDiagnosticReport(ourServiceRequest, advaPacsDiagnosticReport, oystehr);
};

const handleUpdateDiagnosticReport = async (
  advaPacsDiagnosticReport: DiagnosticReport,
  ourDiagnosticReport: DiagnosticReport,
  additionalResources: HandleDrAdditionalResources,
  oystehr: Oystehr
): Promise<void> => {
  console.log('processing DiagnosticReport update');

  console.log('Updating our DiagnosticReport with ID: ', ourDiagnosticReport.id);

  const requests: BatchInputRequest<FhirResource>[] = [];
  const diagnosticReportPathOps: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: advaPacsDiagnosticReport.status,
    },
    {
      op: 'add',
      path: '/presentedForm',
      value: advaPacsDiagnosticReport.presentedForm,
    },
  ];

  if (advaPacsDiagnosticReport.issued && ourDiagnosticReport.issued == null) {
    diagnosticReportPathOps.push({
      op: 'add',
      path: '/issued',
      value: advaPacsDiagnosticReport.issued,
    });
  } else if (advaPacsDiagnosticReport.issued && ourDiagnosticReport.issued) {
    diagnosticReportPathOps.push({
      op: 'replace',
      path: '/issued',
      value: advaPacsDiagnosticReport.issued,
    });
  } else if (
    ourDiagnosticReport.status !== advaPacsDiagnosticReport.status &&
    advaPacsDiagnosticReport.status === 'final'
  ) {
    diagnosticReportPathOps.push({
      op: 'add',
      path: '/issued',
      value: DateTime.now().toISO(),
    });
  }

  if (ourDiagnosticReport.status !== advaPacsDiagnosticReport.status && advaPacsDiagnosticReport.status === 'final') {
    const reviewTaskPostRequest = configReviewResultTask(ourDiagnosticReport, additionalResources);
    console.log('task config to be made', JSON.stringify(reviewTaskPostRequest.resource));
    requests.push(reviewTaskPostRequest);
  }

  console.log('Updating our DiagnosticReport with operations: ', JSON.stringify(diagnosticReportPathOps, null, 2));

  requests.push({
    method: 'PATCH',
    url: `DiagnosticReport/${ourDiagnosticReport.id}`,
    operations: diagnosticReportPathOps,
  });

  console.log(`making transaction request for handleUpdateDiagnosticReport`);
  await oystehr.fhir.transaction({ requests });
};

const configReviewResultTask = (
  diagnosticReport: DiagnosticReport,
  additionalResources: HandleDrAdditionalResources
): BatchInputPostRequest<Task> => {
  console.log('configuring review radiology final results task for', diagnosticReport.id);
  const { encounter, serviceRequest, patient, requestingProvider } = additionalResources;
  const serviceRequestRef = diagnosticReport.basedOn?.find((ref) => ref.reference?.startsWith('ServiceRequest/'))
    ?.reference;
  const appointmentId = encounter.appointment?.[0].reference?.replace('Appointment/', '');
  const locationId = encounter.location
    ?.find((loc) => loc.location.reference?.startsWith('Location/'))
    ?.location.reference?.replace('Location/', '');
  const providerFirstName = requestingProvider?.name?.[0]?.given?.[0];
  const providerLastName = requestingProvider?.name?.[0]?.family;

  const newTask = createTask({
    category: RADIOLOGY_TASK.category,
    code: {
      system: RADIOLOGY_TASK.system,
      code: RADIOLOGY_TASK.code.reviewFinalResultTask,
    },
    encounterId: encounter.id,
    basedOn: [`DiagnosticReport/${diagnosticReport.id}`, ...(serviceRequestRef ? [serviceRequestRef] : [])],
    location: locationId ? { id: locationId } : undefined,
    input: [
      {
        type: RADIOLOGY_TASK.input.appointmentId,
        valueString: appointmentId,
      },
      {
        type: RADIOLOGY_TASK.input.orderDate,
        valueString: serviceRequest.authoredOn,
      },
      {
        type: RADIOLOGY_TASK.input.patientName,
        valueString: getFullestAvailableName(patient),
      },
      {
        type: RADIOLOGY_TASK.input.providerName,
        valueString: `${providerFirstName} ${providerLastName}`,
      },
    ],
  });

  const taskPostRequest: BatchInputPostRequest<Task> = {
    method: 'POST',
    url: 'Task/',
    resource: newTask,
  };
  return taskPostRequest;
};

const validateAdditionalResources = (
  diagnosticReport: DiagnosticReport,
  serviceRequests: ServiceRequest[],
  patients: Patient[],
  encounters: Encounter[],
  practitioners: Practitioner[]
): HandleDrAdditionalResources => {
  if (serviceRequests.length !== 1) {
    throw new Error(
      `Unexpected number of serviceRequests found for diagnostic report: ${diagnosticReport.id}. SR Len: ${serviceRequests.length}`
    );
  }
  if (patients.length !== 1) {
    throw new Error(
      `Unexpected number of patients found for diagnostic report: ${diagnosticReport.id}. Patients Len: ${patients.length}`
    );
  }
  if (encounters.length !== 1) {
    throw new Error(
      `Unexpected number of encounters found for diagnostic report: ${diagnosticReport.id}. Encounters Len: ${encounters.length}`
    );
  }
  if (practitioners.length !== 1) {
    throw new Error(
      `Unexpected number of practitioners found for diagnostic report: ${diagnosticReport.id}. Practitioners Len: ${practitioners.length}`
    );
  }

  return {
    patient: patients[0],
    serviceRequest: serviceRequests[0],
    encounter: encounters[0],
    requestingProvider: practitioners[0],
  };
};

const handleImagingStudy = async (
  advaPacsImagingStudy: ImagingStudyR5,
  oystehr: Oystehr,
  secrets: Secrets
): Promise<void> => {
  console.log('Processing ImagingStudy');
  const accessionNumber = advaPacsImagingStudy.identifier?.find(
    (identifier) => identifier.system === ACCESSION_NUMBER_CODE_SYSTEM
  )?.value;
  if (accessionNumber == null) {
    throw new Error('The ImagingStudy did not have an accession number');
  }
  await updateServiceRequestToCompletedInAdvaPacs(accessionNumber, secrets);
  console.log('PACS SR PUT succeeded in updating SR to completed');
};

const getAdvaPacsServiceRequestByID = async (
  serviceRequestRelativeReference: string,
  secrets: Secrets
): Promise<ServiceRequest> => {
  try {
    const advapacsClientId = getSecret(SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
    const advapacsClientSecret = getSecret(SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
    const advapacsAuthString = `ID=${advapacsClientId},Secret=${advapacsClientSecret}`;

    const advapacsResponse = await fetch(`${ADVAPACS_FHIR_BASE_URL}/${serviceRequestRelativeReference}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/fhir+json',
        Authorization: advapacsAuthString,
      },
    });
    if (!advapacsResponse.ok) {
      throw new Error(
        `advapacs transaction errored out with statusCode ${advapacsResponse.status}, status text ${
          advapacsResponse.statusText
        }, and body ${JSON.stringify(await advapacsResponse.json(), null, 2)}`
      );
    }

    const maybeSR = await advapacsResponse.json();

    if (maybeSR.resourceType !== 'ServiceRequest') {
      throw new Error(`Expected ServiceRequest but got ${maybeSR.resourceType}`);
    }

    return maybeSR;
  } catch (error) {
    console.log('getAdvaPacsServiceRequestByID error: ', error);
    throw error;
  }
};

const getOurServiceRequestByAccessionNumber = async (
  accessionNumber: string,
  oystehr: Oystehr
): Promise<ServiceRequest> => {
  const srResults = (
    await oystehr.fhir.search<ServiceRequest>({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: '_tag',
          value: `${ORDER_TYPE_CODE_SYSTEM}|radiology`,
        },
        {
          name: 'identifier',
          // TODO can we include also the type.coding.system & code to be super exact here?
          value: `${ACCESSION_NUMBER_CODE_SYSTEM}|${accessionNumber}`,
        },
      ],
    })
  ).unbundle();

  if (srResults.length === 0) {
    throw new Error('No ServiceRequest found with the given accession number');
  }

  if (srResults.length > 1) {
    throw new Error('Multiple ServiceRequests found with the given accession number');
  }

  return srResults[0];
};

const updateServiceRequestToCompletedInAdvaPacs = async (accessionNumber: string, secrets: Secrets): Promise<void> => {
  try {
    const advapacsClientId = getSecret(SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
    const advapacsClientSecret = getSecret(SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
    const advapacsAuthString = `ID=${advapacsClientId},Secret=${advapacsClientSecret}`;

    if (!accessionNumber) {
      throw new Error('No accession number found in oystehr service request, cannot update AdvaPACS.');
    }

    // Advapacs doesn't support PATCH or optimistic locking right now so the best we can do is GET the latest, and PUT back with the status changed.
    // First, search up the SR in AdvaPACS by the accession number
    const findServiceRequestResponse = await fetch(
      `${ADVAPACS_FHIR_BASE_URL}/ServiceRequest?identifier=${ACCESSION_NUMBER_CODE_SYSTEM}%7C${accessionNumber}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/fhir+json',
          Authorization: advapacsAuthString,
        },
      }
    );

    if (!findServiceRequestResponse.ok) {
      throw new Error(
        `advapacs search errored out with statusCode ${findServiceRequestResponse.status}, status text ${
          findServiceRequestResponse.statusText
        }, and body ${JSON.stringify(await findServiceRequestResponse.json(), null, 2)}`
      );
    }

    const maybeAdvaPACSSr = await findServiceRequestResponse.json();

    if (maybeAdvaPACSSr.resourceType !== 'Bundle') {
      throw new Error(`Expected response to be Bundle but got ${maybeAdvaPACSSr.resourceType}`);
    }

    if (maybeAdvaPACSSr.entry.length === 0) {
      throw new Error(`No service request found in AdvaPACS for accession number ${accessionNumber}`);
    }
    if (maybeAdvaPACSSr.entry.length > 1) {
      throw new Error(
        `Found multiple service requests in AdvaPACS for accession number ${accessionNumber}, cannot update.`
      );
    }

    const advapacsSR = maybeAdvaPACSSr.entry[0].resource as ServiceRequest;

    if (advapacsSR.status === 'completed') {
      console.log('ServiceRequest is already completed in AdvaPACS, no need to update');
      return;
    }

    // Update the AdvaPACS SR now that we have its latest data.
    const advapacsResponse = await fetch(`${ADVAPACS_FHIR_BASE_URL}/ServiceRequest/${advapacsSR.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/fhir+json',
        Authorization: advapacsAuthString,
      },
      body: JSON.stringify({
        ...advapacsSR,
        status: 'completed',
      }),
    });
    if (!advapacsResponse.ok) {
      throw new Error(
        `advapacs transaction errored out with statusCode ${advapacsResponse.status}, status text ${
          advapacsResponse.statusText
        }, and body ${JSON.stringify(await advapacsResponse.json(), null, 2)}`
      );
    }
  } catch (error) {
    console.error('Error updating service request to complete in AdvaPacs:', error);
    throw new Error('Failed to update service request to complete in AdvaPacs');
  }
};
