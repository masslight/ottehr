import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Communication,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  Practitioner,
  Provenance,
  QuestionnaireResponse,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  docRefIsAbnAndCurrent,
  DynamicAOEInput,
  EXTERNAL_LAB_ERROR,
  getFullestAvailableName,
  getPatchBinary,
  LAB_DR_TYPE_TAG,
  LAB_ORDER_CLINICAL_INFO_COMM_CATEGORY,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  OYSTEHR_SAME_TRANSMISSION_DR_REF_URL,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  SpecimenCollectionDateConfig,
  SR_REVOKED_REASON_EXT,
} from 'utils';
import { createOwnerReference } from '../../shared/tasks';
import { parseAccessionNumberFromDr, populateQuestionnaireResponseItems } from '../shared/labs';

export const getSpecimenPatchAndMostRecentCollectionDate = (
  specimenResources: Specimen[],
  specimenCollectionDates: SpecimenCollectionDateConfig,
  practitionerIdFromCurrentUser: string
): {
  specimenPatchRequests: BatchInputPatchRequest<Specimen>[];
  mostRecentCollectionDate: DateTime | undefined;
} => {
  let mostRecentCollectionDate: DateTime | undefined;
  const sampleCollectionDates: DateTime[] = [];
  const specimenPatchRequests: BatchInputPatchRequest<Specimen>[] = [];

  for (const specimen of specimenResources) {
    const dateToPatch = specimenCollectionDates && specimen.id ? specimenCollectionDates[specimen.id].date : undefined;
    const date = dateToPatch ? DateTime.fromISO(dateToPatch) : undefined;
    if (date) {
      sampleCollectionDates.push(date);
      const request = makeSpecimenPatchRequest(specimen, date, practitionerIdFromCurrentUser);
      specimenPatchRequests.push(request);
    } else {
      console.error(`issue parsing specimen collection date for ${specimen.id}, date passed: ${dateToPatch}`);
      throw EXTERNAL_LAB_ERROR('Error parsing specimen collection date');
    }
  }

  if (sampleCollectionDates.length > 0) {
    mostRecentCollectionDate = DateTime.max(...sampleCollectionDates);
    console.log('mostRecentCollectionDate', mostRecentCollectionDate);
  }

  return { specimenPatchRequests, mostRecentCollectionDate };
};

export const makeSpecimenPatchRequest = (
  specimen: Specimen,
  date: DateTime | undefined,
  practitionerIdFromCurrentUser: string
): BatchInputPatchRequest<Specimen> => {
  const hasSpecimenCollection = specimen.collection;
  const hasSpecimenDateTime = specimen.collection?.collectedDateTime;
  const hasSpecimenCollector = specimen.collection?.collector;

  // new values
  const specimenCollector = { reference: `Practitioner/${practitionerIdFromCurrentUser}` };

  const operations: Operation[] = [];

  if (hasSpecimenCollection) {
    console.log('specimen collection found');
    operations.push(
      {
        path: '/collection/collector',
        op: hasSpecimenCollector ? 'replace' : 'add',
        value: specimenCollector,
      },
      {
        path: '/collection/collectedDateTime',
        op: hasSpecimenDateTime ? 'replace' : 'add',
        value: date,
      }
    );
  } else {
    console.log('adding collection to specimen');
    operations.push({
      path: '/collection',
      op: 'add',
      value: {
        collectedDateTime: date,
        collector: specimenCollector,
      },
    });
  }

  const specimenPatchRequest: BatchInputPatchRequest<Specimen> = {
    method: 'PATCH',
    url: `Specimen/${specimen.id}`,
    operations: operations,
  };
  return specimenPatchRequest;
};

export const makeQrPatchRequest = async (
  qr: QuestionnaireResponse,
  data: DynamicAOEInput,
  m2mToken: string
): Promise<BatchInputPatchRequest<QuestionnaireResponse>> => {
  const { questionnaireResponseItems } = await populateQuestionnaireResponseItems(qr, data, m2mToken);

  return {
    method: 'PATCH',
    url: `QuestionnaireResponse/${qr.id}`,
    operations: [
      { op: 'add', path: '/item', value: questionnaireResponseItems },
      { op: 'replace', path: '/status', value: 'completed' },
    ],
  };
};

export const makePstCompletePatchRequests = async (
  oystehr: Oystehr,
  pstTask: Task,
  sr: ServiceRequest,
  practitionerIdFromCurrentUser: string,
  now: DateTime<true>
): Promise<BatchInputRequest<Provenance | Task>[]> => {
  const curUserReference = { reference: `Practitioner/${practitionerIdFromCurrentUser}` };
  const provenanceFhirUrl = `urn:uuid:${uuid()}`;

  const provenanceFhir: Provenance = {
    resourceType: 'Provenance',
    target: [
      {
        reference: `ServiceRequest/${sr.id}`,
      },
    ],
    recorded: now.toISO(),
    location: pstTask.location,
    agent: [{ who: curUserReference }],
    activity: {
      coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.completePstTask],
    },
  };

  const pstTaskOperations: Operation[] = [
    {
      op: 'add',
      path: '/relevantHistory',
      value: [
        {
          reference: provenanceFhirUrl,
        },
      ],
    },
    {
      op: 'replace',
      path: '/status',
      value: 'completed',
    },
  ];

  if (!pstTask.owner) {
    const currentUserPractitioner = await oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: practitionerIdFromCurrentUser,
    });
    pstTaskOperations.push({
      path: '/owner',
      op: 'add',
      value: createOwnerReference(
        practitionerIdFromCurrentUser,
        getFullestAvailableName(currentUserPractitioner) ?? ''
      ),
    });
  }

  const requests: BatchInputRequest<Provenance | Task>[] = [
    {
      method: 'POST',
      url: '/Provenance',
      fullUrl: provenanceFhirUrl,
      resource: provenanceFhir,
    },
    getPatchBinary({
      resourceType: 'Task',
      resourceId: pstTask.id || 'unknown',
      patchOperations: pstTaskOperations,
    }),
  ];

  return requests;
};

/**
 * Marks the unsolicited result task as complete.
 * Links the patient to the diagnostic report.
 *
 * If a service request ID is provided:
 * - Links the service request to the diagnostic report.
 * - If the diagnostic report status is 'final', updates the service request status to 'completed'.
 */
export const handleMatchUnsolicitedRequest = async ({
  oystehr,
  taskId,
  diagnosticReportId,
  patientToMatchId,
  practitionerIdFromCurrentUser,
  srToMatchId,
}: {
  oystehr: Oystehr;
  taskId: string;
  diagnosticReportId: string;
  patientToMatchId: string;
  practitionerIdFromCurrentUser: string;
  srToMatchId?: string;
}): Promise<void> => {
  console.log('getting the diagnostic report', diagnosticReportId);
  const diagnosticReportResource = await oystehr.fhir.get<DiagnosticReport>({
    resourceType: 'DiagnosticReport',
    id: diagnosticReportId,
  });

  // searching for any PDF attachment DR with the correct filler id, tags
  // and then checking that the DR being matched is referenced as expected in the extension
  const fillerId = parseAccessionNumberFromDr(diagnosticReportResource);
  let relatedPdfAttachmentDrs: DiagnosticReport[] | undefined;
  if (fillerId && fillerId !== '') {
    console.log('searching for any pdf attachment drs that will also need to be matched');
    const pdfAttachmentDrSearch = (
      await oystehr.fhir.search<DiagnosticReport>({
        resourceType: 'DiagnosticReport',
        params: [
          { name: 'identifier', value: fillerId },
          { name: '_tag', value: LAB_DR_TYPE_TAG.code.attachment },
          { name: '_tag', value: LAB_DR_TYPE_TAG.code.unsolicited },
        ],
      })
    ).unbundle();
    console.log('number of pdfAttachment DRs found', pdfAttachmentDrSearch.length);
    const pdfAttachmentDrsValidated = pdfAttachmentDrSearch.filter((dr) => {
      const relatedDrIds = dr.extension
        ?.filter(
          (ext) =>
            ext.url === OYSTEHR_SAME_TRANSMISSION_DR_REF_URL &&
            ext?.valueReference?.reference?.startsWith('DiagnosticReport/')
        )
        .map((ext) => ext.valueReference?.reference?.replace('DiagnosticReport/', ''));
      const drIsRelated = !!relatedDrIds?.includes(diagnosticReportId);
      return drIsRelated;
    });
    console.log('number of pdfAttachment validated to be related', pdfAttachmentDrsValidated.length);
    if (pdfAttachmentDrsValidated.length > 0) relatedPdfAttachmentDrs = pdfAttachmentDrsValidated;
  }

  console.log('formatting fhir patch requests to handle matching unsolicited results');
  const task = await oystehr.fhir.get<Task>({
    resourceType: 'Task',
    id: taskId,
  });

  const taskOperations: Operation[] = [{ op: 'replace', path: '/status', value: 'completed' }];

  if (!task.owner) {
    const currentUserPractitioner = await oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: practitionerIdFromCurrentUser,
    });
    taskOperations.push({
      path: '/owner',
      op: 'add',
      value: createOwnerReference(
        practitionerIdFromCurrentUser,
        getFullestAvailableName(currentUserPractitioner) ?? ''
      ),
    });
  }

  const markTaskAsCompleteRequest: BatchInputPatchRequest<Task> = {
    method: 'PATCH',
    url: `Task/${taskId}`,
    operations: taskOperations,
  };

  const updatedDiagnosticReport: DiagnosticReport = { ...diagnosticReportResource };
  const curSubjectRef = diagnosticReportResource.subject?.reference?.replace('#', '');
  console.log('dr curSubjectRef', curSubjectRef);
  updatedDiagnosticReport.subject = { reference: `Patient/${patientToMatchId}` };
  updatedDiagnosticReport.contained = diagnosticReportResource.contained?.filter(
    (resource) => resource.id !== curSubjectRef
  );

  const serviceRequestPatch: BatchInputPatchRequest<ServiceRequest>[] = [];
  if (srToMatchId) {
    console.log('srToMatchId passed: ', srToMatchId);
    if (updatedDiagnosticReport.basedOn) {
      updatedDiagnosticReport.basedOn.push({ reference: `ServiceRequest/${srToMatchId}` });
    } else {
      updatedDiagnosticReport.basedOn = [{ reference: `ServiceRequest/${srToMatchId}` }];
    }

    // this write normally happens on the oystehr side but since the result came in as unsolicited it would not have happened there
    if (updatedDiagnosticReport.status === 'final') {
      console.log('dr status is final so patching sr status to completed');
      serviceRequestPatch.push({
        method: 'PATCH',
        url: `ServiceRequest/${srToMatchId}`,
        operations: [{ op: 'replace', path: '/status', value: 'completed' }],
      });
    }
  }

  const diagnosticReportPutRequest: BatchInputRequest<DiagnosticReport> = {
    method: 'PUT',
    url: `DiagnosticReport/${diagnosticReportResource.id}`,
    resource: updatedDiagnosticReport,
    ifMatch: diagnosticReportResource.meta?.versionId ? `W/"${diagnosticReportResource.meta.versionId}"` : undefined,
  };

  const requests = [diagnosticReportPutRequest, markTaskAsCompleteRequest, ...serviceRequestPatch];

  if (relatedPdfAttachmentDrs) {
    relatedPdfAttachmentDrs.forEach((dr) => {
      console.log('adding request to patch pdf attachment dr with patient as subject', dr.id);
      const updatedDr: DiagnosticReport = { ...dr };
      updatedDr.subject = { reference: `Patient/${patientToMatchId}` };
      const pdfAttachmentDrPutRequest: BatchInputRequest<DiagnosticReport> = {
        method: 'PUT',
        url: `DiagnosticReport/${dr.id}`,
        resource: updatedDr,
        ifMatch: dr.meta?.versionId ? `W/"${dr.meta.versionId}"` : undefined,
      };
      requests.push(pdfAttachmentDrPutRequest);
    });
  }

  console.log('making fhir requests, total requests to make: ', requests.length);
  await oystehr.fhir.transaction<DiagnosticReport | Task | ServiceRequest>({ requests });
};

export const handleRejectedAbn = async ({
  oystehr,
  serviceRequestId,
  practitionerIdFromCurrentUser,
}: {
  oystehr: Oystehr;
  serviceRequestId: string;
  practitionerIdFromCurrentUser: string;
}): Promise<void> => {
  const resourceSearch = (
    await oystehr.fhir.search<ServiceRequest | DocumentReference>({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: '_id',
          value: serviceRequestId,
        },
        {
          name: '_revinclude:iterate',
          value: 'DocumentReference:related', // to validate there is an abn doc
        },
      ],
    })
  ).unbundle();
  console.log(`resource search for handleRejectedAbn returned ${resourceSearch.length}`);

  const initial: { abnDocRef: DocumentReference | undefined; serviceRequest: ServiceRequest | undefined } = {
    abnDocRef: undefined,
    serviceRequest: undefined,
  };
  const { abnDocRef, serviceRequest } = resourceSearch.reduce((acc, resource) => {
    if (resource.resourceType === 'ServiceRequest' && resource.status !== 'completed') {
      acc.serviceRequest = resource;
    }
    if (resource.resourceType === 'DocumentReference') {
      if (docRefIsAbnAndCurrent(resource)) acc.abnDocRef = resource;
    }
    return acc;
  }, initial);

  if (!abnDocRef) {
    throw new Error(
      `ABN rejection failed: there is no current abn document reference for this lab. ${serviceRequestId}`
    );
  }

  if (!serviceRequest) {
    throw new Error(`ABN rejection failed: did not find service request resource. ${serviceRequestId}`);
  }

  console.log('formatting requests for handleRejectedAbn');

  const srExtension = serviceRequest?.extension;
  const srPatch: BatchInputPatchRequest<ServiceRequest> = {
    method: 'PATCH',
    url: `ServiceRequest/${serviceRequestId}`,
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: 'revoked',
      },
      {
        op: 'add',
        path: srExtension ? '/extension/-' : '/extension',
        value: srExtension ? SR_REVOKED_REASON_EXT : [SR_REVOKED_REASON_EXT],
      },
    ],
  };

  const curUserReference = { reference: `Practitioner/${practitionerIdFromCurrentUser}` };
  const provenancePost: BatchInputPostRequest<Provenance> = {
    method: 'POST',
    url: '/Provenance',
    resource: {
      resourceType: 'Provenance',
      target: [
        {
          reference: `ServiceRequest/${serviceRequestId}`,
        },
      ],
      recorded: DateTime.now().toISO(),
      agent: [{ who: curUserReference }],
      activity: {
        coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.abnRejected],
      },
    },
  };

  console.log('revoking the service request due to rejected abn');
  await oystehr.fhir.transaction({ requests: [srPatch, provenancePost] });
};

export const handleRejectedUnsolicitedResult = async ({
  oystehr,
  taskId,
}: {
  oystehr: Oystehr;
  taskId: string;
}): Promise<void> => {
  console.log('searching for task and diagnostic report within handleRejectedUnsolicitedResult');
  const resources = (
    await oystehr.fhir.search<Task | DiagnosticReport>({
      resourceType: 'Task',
      params: [
        {
          name: '_id',
          value: taskId,
        },
        {
          name: '_include:iterate',
          value: 'Task:based-on',
        },
      ],
    })
  ).unbundle();

  console.log('number of resources returned from search:', resources.length);

  const { fhirTask, fhirDiagnosticReport } = resources.reduce(
    (acc: { fhirTask: Task | undefined; fhirDiagnosticReport: DiagnosticReport | undefined }, resource) => {
      if (resource.resourceType === 'Task') acc.fhirTask = resource;
      if (resource.resourceType === 'DiagnosticReport') acc.fhirDiagnosticReport = resource;
      return acc;
    },
    { fhirTask: undefined, fhirDiagnosticReport: undefined }
  );

  if (!fhirTask)
    throw new Error(`Something has gone awry getting this task during handleRejectedUnsolicitedResult: ${taskId}`);

  const requests: BatchInputPatchRequest<Task | DiagnosticReport>[] = [
    {
      method: 'PATCH',
      url: `Task/${taskId}`,
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: 'cancelled',
        },
      ],
    },
  ];

  // this means it was matched and is being rejected AFTER being matched
  if (fhirDiagnosticReport && fhirDiagnosticReport.subject?.reference?.startsWith('Patient/')) {
    console.log(
      'it appears this unsolicited result has been matched to a patient - the subject patient will be removed and the task will be cancelled'
    );
    requests.push({
      method: 'PATCH',
      url: `DiagnosticReport/${fhirDiagnosticReport.id}`,
      operations: [
        {
          op: 'remove',
          path: '/subject',
        },
      ],
    });
  } else {
    console.log(
      'this unsolicited result is being rejected before matching to a patient, the only action to be taken is cancelling the task'
    );
  }

  await oystehr.fhir.transaction({ requests });
};

export const handleAddOrderLevelNote = async ({
  oystehr,
  requisitionNumber,
  note,
}: {
  oystehr: Oystehr;
  requisitionNumber: string;
  note: string;
}): Promise<void> => {
  const resourceSearch = (
    await oystehr.fhir.search<ServiceRequest | Encounter>({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: 'identifier',
          value: `${OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM}|${requisitionNumber}`,
        },
        {
          name: '_include:iterate',
          value: 'ServiceRequest:encounter',
        },
      ],
    })
  ).unbundle();
  console.log(`resource search for handleAddOrderLevelNote returned ${resourceSearch.length}`);

  const { serviceRequests, encounters } = resourceSearch.reduce(
    (acc: { serviceRequests: ServiceRequest[]; encounters: Encounter[] }, resource) => {
      if (resource.resourceType === 'ServiceRequest') acc.serviceRequests.push(resource);
      if (resource.resourceType === 'Encounter') acc.encounters.push(resource);
      return acc;
    },
    { serviceRequests: [], encounters: [] }
  );

  if (encounters.length !== 1) {
    throw Error(
      `All service requests in an order bundle should be linked to the same encounter. However, more than one encounter was found for this order ${requisitionNumber}`
    );
  }
  const encounter = encounters[0];

  const communicationConfig: Communication = {
    resourceType: 'Communication',
    status: 'completed', // todo sarah confirm this makes sense
    identifier: [
      {
        system: OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
        value: requisitionNumber,
      },
    ],
    basedOn: serviceRequests.map((sr) => ({ reference: `ServiceRequest/${sr.id}` })),
    encounter: { reference: `Encounter/${encounter.id}` },
    category: [
      {
        coding: [LAB_ORDER_CLINICAL_INFO_COMM_CATEGORY],
      },
    ],
    payload: [{ contentString: note }],
  };

  await oystehr.fhir.create<Communication>(communicationConfig);
};

export const handleUpdateOrderLevelNote = async ({
  oystehr,
  requisitionNumber,
  note,
}: {
  oystehr: Oystehr;
  requisitionNumber: string;
  note: string;
}): Promise<void> => {
  console.log('searching for the order level note communication');
  const resourceSearch = (
    await oystehr.fhir.search<Communication>({
      resourceType: 'Communication',
      params: [
        {
          name: 'identifier',
          value: `${OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM}|${requisitionNumber}`,
        },
        {
          name: 'category',
          value: `${LAB_ORDER_CLINICAL_INFO_COMM_CATEGORY.system}|${LAB_ORDER_CLINICAL_INFO_COMM_CATEGORY.code}`,
        },
      ],
    })
  ).unbundle();
  console.log(`resource search for handleAddOrderLevelNote returned ${resourceSearch.length}`);

  if (resourceSearch.length !== 1) {
    throw new Error(
      `An unexpected number of resources were returned when searching to update the order level note for requisition ${requisitionNumber}. Return count: ${resourceSearch.length}`
    );
  }

  const communication = resourceSearch.find((resource) => resource.resourceType === 'Communication');
  if (!communication) {
    throw new Error(`Could not find the order level note communication for requsition $requisitionNumber}`);
  }

  if (note) {
    console.log('Updating order level note');
    await oystehr.fhir.update<Communication>({
      ...communication,
      payload: [
        {
          contentString: note,
        },
      ],
    });
  } else {
    if (!communication.id) throw new Error(`no id for this communication ?? ${JSON.stringify(communication)}`);
    console.log('note was sent as an empty string, we will delete the communication');
    await oystehr.fhir.delete<Communication>({ resourceType: 'Communication', id: communication.id });
  }
};
