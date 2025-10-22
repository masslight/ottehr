import Oystehr, { BatchInputPatchRequest, BatchInputRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { DiagnosticReport, Provenance, QuestionnaireResponse, ServiceRequest, Specimen, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  DynamicAOEInput,
  EXTERNAL_LAB_ERROR,
  getPatchBinary,
  LAB_DR_TYPE_TAG,
  LAB_ORDER_TASK,
  OYSTEHR_SAME_TRANSMISSION_DR_REF_URL,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  SpecimenCollectionDateConfig,
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
} from 'utils';
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

export const makePstCompletePatchRequests = (
  pstTask: Task,
  sr: ServiceRequest,
  practitionerIdFromCurrentUser: string,
  now: DateTime<true>
): BatchInputRequest<Provenance | Task>[] => {
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
      patchOperations: [
        {
          op: 'add',
          path: '/owner',
          value: {
            ...curUserReference,
            extension: [
              {
                url: TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
                valueDateTime: DateTime.now().toISO(),
              },
            ],
          },
        },
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
      ],
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
  srToMatchId,
}: {
  oystehr: Oystehr;
  taskId: string;
  diagnosticReportId: string;
  patientToMatchId: string;
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
  const markTaskAsCompleteRequest: BatchInputPatchRequest<Task> = {
    method: 'PATCH',
    url: `Task/${taskId}`,
    operations: [{ op: 'replace', path: '/status', value: 'completed' }],
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

  const matchUnsolicitedTask = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        { name: 'based-on', value: `DiagnosticReport/${diagnosticReportResource.id}` },
        { name: 'code', value: LAB_ORDER_TASK.system + '|' + LAB_ORDER_TASK.code.matchUnsolicited },
      ],
    })
  ).unbundle()[0];
  if (matchUnsolicitedTask?.id) {
    requests.push(
      getPatchBinary({
        resourceType: 'Task',
        resourceId: matchUnsolicitedTask.id,
        patchOperations: [
          {
            op: 'replace',
            path: '/status',
            value: 'completed',
          },
        ],
      })
    );
  }

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
