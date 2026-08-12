import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  Location,
  Organization,
  Patient,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import { LAB_ORDER_TASK, LAB_RESULT_DOC_REF_CODING_CODE, LabDrTypeTagCode, LabOrderTaskCode } from 'utils';

export const ACCEPTED_RESULTS_STATUS = ['preliminary', 'final', 'corrected', 'cancelled'];
type AcceptedResultsStatus = (typeof ACCEPTED_RESULTS_STATUS)[number];

const STATUS_CODE_MAP: Record<AcceptedResultsStatus, LabOrderTaskCode> = {
  preliminary: LAB_ORDER_TASK.code.reviewPreliminaryResult,
  final: LAB_ORDER_TASK.code.reviewFinalResult,
  corrected: LAB_ORDER_TASK.code.reviewCorrectedResult,
  cancelled: LAB_ORDER_TASK.code.reviewCancelledResult,
};

export const getCodeForNewTask = (dr: DiagnosticReport, isUnsolicited: boolean, matched: boolean): string => {
  if (isUnsolicited && !matched) {
    return LAB_ORDER_TASK.code.matchUnsolicitedResult;
  } else {
    return STATUS_CODE_MAP[dr.status];
  }
};

interface DrDetails {
  drType: LabDrTypeTagCode | undefined;
  isUnsolicited: boolean;
  isUnsolicitedAndMatched: boolean;
}

export async function fetchRelatedResources(
  diagnosticReport: DiagnosticReport,
  drDetails: DrDetails,
  oystehr: Oystehr
): Promise<{
  tasks: Task[];
  patient?: Patient;
  labOrg?: Organization;
  encounter?: Encounter;
  attachments?: DocumentReference[];
  location?: Location;
}> {
  const resources = (
    await oystehr.fhir.search<
      DiagnosticReport | Patient | Organization | Task | Encounter | DocumentReference | Location
    >({
      resourceType: 'DiagnosticReport',
      params: [
        { name: '_id', value: diagnosticReport.id ?? '' },
        { name: '_revinclude:iterate', value: 'Task:based-on' },
        { name: '_include', value: 'DiagnosticReport:subject' }, // patient
        { name: '_include', value: 'DiagnosticReport:performer' }, // lab org
        { name: '_include', value: 'DiagnosticReport:encounter' }, // to grab the appointment id
        { name: '_include:iterate', value: 'Encounter:location' }, // we'll grab location either from here for solicited and reflex results
        { name: '_revinclude', value: 'DocumentReference:related' }, // to grab any lab generated attachments
      ],
    })
  ).unbundle();

  // when determining location, we need to be a little clever if the result is reflex or unsolicited
  const [preSubmissionTask, unsolicitedResultLocation] = await Promise.all([
    (async (): Promise<Task | undefined> => {
      const serviceRequestId = diagnosticReport?.basedOn
        ?.find((temp) => temp.reference?.startsWith('ServiceRequest/'))
        ?.reference?.split('/')[1];

      const preSubmissionTask = serviceRequestId
        ? (
            await oystehr.fhir.search<Task>({
              resourceType: 'Task',
              params: [
                { name: 'based-on', value: `ServiceRequest/${serviceRequestId}` },
                { name: 'code', value: LAB_ORDER_TASK.system + '|' + LAB_ORDER_TASK.code.preSubmission },
              ],
            })
          ).unbundle()[0]
        : undefined;

      return preSubmissionTask;
    })(),
    getLocationForUnsolicitedResult(diagnosticReport, drDetails, oystehr),
  ]);

  if (preSubmissionTask) {
    resources.push(preSubmissionTask);
  }

  const result: {
    tasks: Task[];
    patient?: Patient;
    labOrg?: Organization;
    encounter?: Encounter; // unsolicited results will not have
    attachments?: DocumentReference[];
    location?: Location;
  } = { tasks: [] };

  let diagnosticReportLocation: Location | undefined = undefined;

  resources.forEach((resource) => {
    if (resource.resourceType === 'Task') {
      result.tasks.push(resource);
    }
    if (resource.resourceType === 'Patient') {
      result.patient = resource;
    }
    if (resource.resourceType === 'Organization') {
      result.labOrg = resource;
    }
    if (resource.resourceType === 'Encounter') {
      result.encounter = resource;
    }
    if (
      resource.resourceType === 'DocumentReference' &&
      resource.status === 'current' &&
      resource.type?.coding?.some(
        (coding) =>
          coding.system === LAB_RESULT_DOC_REF_CODING_CODE.system && coding.code === LAB_RESULT_DOC_REF_CODING_CODE.code
      )
    ) {
      if (result.attachments) result.attachments.push(resource);
      else result.attachments = [resource];
    }
    if (resource.resourceType === 'Location') diagnosticReportLocation = resource;
  });

  result.location = drDetails.isUnsolicited ? unsolicitedResultLocation : diagnosticReportLocation;

  return result;
}

const getLocationForUnsolicitedResult = async (
  diagnosticReport: DiagnosticReport,
  drDetails: DrDetails,
  oystehr: Oystehr
): Promise<Location | undefined> => {
  const getLocationForMatchedUnsolicited = async (): Promise<Location | undefined> => {
    // we know if it was matched to a real result vs just a patient by checking the based on.
    // if there's nothing in based-on, we have no way to grab a serviceRequest and will need to check the patient's last appointment location
    const serviceRequestRef = diagnosticReport.basedOn?.find((ref) => ref.reference?.startsWith('ServiceRequest/'))
      ?.reference;

    if (!serviceRequestRef) {
      console.log(
        `DiagnosticReport/${diagnosticReport.id} was a matched unsolicited but had no SR in based-on. Checking patient`
      );

      // in this case we check the patient's most recent Appointment since it has a nice filterable timestamp
      const patientRef = diagnosticReport.subject?.reference;
      if (!patientRef) {
        console.warn(`DiagnosticReport/${diagnosticReport.id} was matched but has no Patient in subject`);
        return;
      }

      const resources = (
        await oystehr.fhir.search<Appointment | Location>({
          resourceType: 'Appointment',
          params: [
            { name: 'patient', value: patientRef },
            { name: '_sort', value: '-date' }, // this is Appointment.start
            { name: '_include', value: 'Appointment:location' },
          ],
        })
      ).unbundle();

      const latestAppointment = resources.filter((res): res is Appointment => res.resourceType === 'Appointment')[0];

      const locationRefFromAppointment = latestAppointment.participant.find(
        (part) => part.actor?.reference?.startsWith('Location/')
      )?.actor?.reference;

      if (!locationRefFromAppointment) {
        console.warn(`Latest appointment Appointment/${latestAppointment.id} did not have a location associated`);
        return;
      }
      const location = resources.find(
        (res): res is Location => res.resourceType === 'Location' && `Location/${res.id}` === locationRefFromAppointment
      );

      return location;
    } else {
      console.log(
        `DiagnosticReport/${diagnosticReport.id} was a matched unsolicited with an SR. Using SR to determine location`
      );

      const locations = (
        await oystehr.fhir.search<ServiceRequest | Location>({
          resourceType: 'ServiceRequest',
          params: [
            { name: '_id', value: serviceRequestRef.split('/')[1] ?? '' },
            {
              name: '_include',
              value: 'ServiceRequest:location',
            },
          ],
        })
      )
        .unbundle()
        .filter((res): res is Location => res.resourceType === 'Location');

      if (!locations.length)
        console.warn(
          `No location found for existing-order-matched unsolicited result DiagnosticReport/${diagnosticReport.id}`
        );

      return locations[0];
    }
  };

  if (drDetails.isUnsolicitedAndMatched) {
    return await getLocationForMatchedUnsolicited();
  } else if (drDetails.isUnsolicited) {
    console.warn(`DiagnosticReport/${diagnosticReport.id} was unmatched unsolicited. Cannot determine location`);
  }
  return;
};
