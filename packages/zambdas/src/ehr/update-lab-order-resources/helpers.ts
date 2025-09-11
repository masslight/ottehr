import Oystehr, { BatchInputPatchRequest, BatchInputRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { DiagnosticReport, Provenance, QuestionnaireResponse, ServiceRequest, Specimen, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  DynamicAOEInput,
  EXTERNAL_LAB_ERROR,
  getPatchBinary,
  OYSTEHR_UNSOLICITED_RESULT_ORDERING_PROVIDER_SYSTEM,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  SpecimenCollectionDateConfig,
} from 'utils';
import { populateQuestionnaireResponseItems } from '../shared/labs';

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
          value: curUserReference,
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
  console.log('formatting fhir patch requests to handle matching unsolicited results');
  const markTaskAsCompleteRequest: BatchInputPatchRequest<Task> = {
    method: 'PATCH',
    url: `Task/${taskId}`,
    operations: [{ op: 'replace', path: '/status', value: 'completed' }],
  };

  const updatedDiagnosticReport: DiagnosticReport = { ...diagnosticReportResource };
  updatedDiagnosticReport.subject = { reference: `Patient/${patientToMatchId}` };
  delete updatedDiagnosticReport.contained;
  if (updatedDiagnosticReport.extension) {
    updatedDiagnosticReport.extension = updatedDiagnosticReport.extension.filter((ext) => {
      return ext.url !== OYSTEHR_UNSOLICITED_RESULT_ORDERING_PROVIDER_SYSTEM;
    });
  }

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
  };

  const requests = [diagnosticReportPutRequest, markTaskAsCompleteRequest, ...serviceRequestPatch];
  console.log('making fhir requests, total requests to make: ', requests.length);
  await oystehr.fhir.transaction<DiagnosticReport | Task | ServiceRequest>({ requests });
};
