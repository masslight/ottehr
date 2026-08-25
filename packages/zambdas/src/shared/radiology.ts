import Oystehr from '@oystehr/sdk';
import {
  DiagnosticReport,
  DocumentReference,
  Encounter,
  Extension,
  Organization,
  Practitioner,
  Reference,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import { FHIR_EXTENSION } from 'utils/lib/fhir/constants';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import {
  LATERALITY_SELECTORS,
  LateralityValue,
  RADIOLOGY_PERFORMING_ORGANIZATION_CONTAINED_ID,
  RADIOLOGY_RESULT_DOC_REF_DOCTYPE,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL,
} from 'utils/lib/fhir/radiology';
import { removePrefix } from 'utils/lib/helpers/helpers';
import {
  RadiologyDTO,
  RadiologyPerformedBy,
  RadiologyPerformingOrganization,
  RadiologySafetyFlag,
} from 'utils/lib/types/api/radiology';
import { RADIOLOGY_TASK } from 'utils/lib/types/data/tasks/types';
import { RADIOLOGY_ERROR } from 'utils/lib/types/errors';

// The single definition of "this radiology order has an uploaded result": a current DocumentReference
// with the radiology-result type coding, related to the ServiceRequest. All radiology consumers must agree.
export const isCurrentRadiologyResultDocRef = (docRef: DocumentReference, serviceRequestId: string): boolean =>
  docRef.status === 'current' &&
  !!docRef.type?.coding?.some(
    (coding) =>
      coding.system === RADIOLOGY_RESULT_DOC_REF_DOCTYPE.system && coding.code === RADIOLOGY_RESULT_DOC_REF_DOCTYPE.code
  ) &&
  !!docRef.context?.related?.some((related) => related.reference === `ServiceRequest/${serviceRequestId}`);

/**
 * The ordering provider shown on an order is the provider assigned to the visit — orders are often placed by
 * a nurse or MA on the provider's behalf, and `ServiceRequest.requester` is only whoever placed the order.
 * Falls back to the requester when the encounter has no attender (or the attender didn't come back in the
 * bundle). Matches how the order form PDF picks its ordering provider.
 */
export const resolveOrderingProvider = (
  serviceRequest: ServiceRequest,
  encounter: Encounter | undefined,
  practitioners: Practitioner[]
): Practitioner | undefined => {
  const findPractitioner = (id: string | undefined): Practitioner | undefined =>
    id ? practitioners.find((practitioner) => practitioner.id === id) : undefined;

  const attendingProvider = findPractitioner(encounter ? getAttendingPractitionerId(encounter) : undefined);
  const requester = findPractitioner(serviceRequest.requester?.reference?.split('/')[1]);

  // A Practitioner without a name would make the order's provider column blank, so prefer one that has one.
  return [attendingProvider, requester].find((practitioner) => practitioner && getFullestAvailableName(practitioner));
};

/**
 * Every practitioner identity that counts as this order's ordering provider: the requester who placed it and
 * the visit's attending provider. `resolveOrderingProvider` picks one of the two for display; anything
 * deciding "did this person order the study?" should accept either, since which of them the caller happens
 * to be is an accident of who did the data entry.
 */
export const getOrderingProviderIds = (serviceRequest: ServiceRequest, encounter: Encounter | undefined): string[] => {
  const requesterId = serviceRequest.requester?.reference?.split('/')[1];
  const attendingId = encounter ? getAttendingPractitionerId(encounter) : undefined;
  return [...new Set([requesterId, attendingId].filter((id): id is string => !!id))];
};

const isPractitionerRef = (ref: Reference): boolean => !!ref.reference?.startsWith('Practitioner/');

/**
 * A report's own author: the Practitioner entry in `performer`. Each read carries its own, so the
 * preliminary and final rows never read the same field, and a read arriving from AdvaPACS — which carries
 * no author of ours — yields nothing rather than borrowing someone else's name.
 */
export const getReportAuthor = (report: DiagnosticReport | undefined): Reference | undefined =>
  report?.performer?.find(isPractitionerRef);

export const getReportAuthorId = (report: DiagnosticReport | undefined): string | undefined =>
  removePrefix('Practitioner/', getReportAuthor(report)?.reference ?? '');

/**
 * Records the practitioner who performed the study on `ServiceRequest.performer`, taking the display name
 * from the Practitioner (which also verifies it exists). Any non-Practitioner performer (an external order's
 * contained performing Organization) is preserved.
 */
export const savePerformedBy = async (
  serviceRequest: ServiceRequest,
  performedById: string,
  oystehr: Oystehr
): Promise<void> => {
  let practitioner: Practitioner;
  try {
    practitioner = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: performedById });
  } catch (error) {
    console.error(`Could not fetch Practitioner/${performedById} for performedBy`, error);
    throw RADIOLOGY_ERROR('The selected performer could not be found.');
  }

  const otherPerformers = (serviceRequest.performer ?? []).filter((ref) => !isPractitionerRef(ref));
  const performer: Reference[] = [
    ...otherPerformers,
    { reference: `Practitioner/${practitioner.id}`, display: getFullestAvailableName(practitioner) },
  ];

  await oystehr.fhir.patch<ServiceRequest>({
    resourceType: 'ServiceRequest',
    id: serviceRequest.id!,
    operations: [
      {
        op: serviceRequest.performer ? 'replace' : 'add',
        path: '/performer',
        value: performer,
      },
    ],
  });
};

/**
 * A standalone copy of the preliminary read, taken in the same transaction that finalizes the report.
 *
 * AdvaPACS keeps one report per order, so the report of record is reused for both reads and the final read
 * overwrites `presentedForm`. Without this copy the preliminary read — the judgment the provider actually
 * treated the patient on — would survive only in resource history, where nothing can display or edit it.
 *
 * It deliberately carries no AdvaPACS identifier: this copy is ours alone, so no callback can address it and
 * an edit to it is never pushed back to the PACS (by then their copy holds the final read).
 */
export const buildPreliminaryReportSnapshot = (reportBeingFinalized: DiagnosticReport): DiagnosticReport => ({
  resourceType: 'DiagnosticReport',
  status: 'preliminary',
  basedOn: reportBeingFinalized.basedOn,
  subject: reportBeingFinalized.subject,
  code: reportBeingFinalized.code,
  category: reportBeingFinalized.category,
  presentedForm: reportBeingFinalized.presentedForm,
  // Carried across before the caller overwrites both with the final read's.
  performer: reportBeingFinalized.performer,
  // Carries the preliminary-review-on extension, which dates the "preliminary" history row.
  extension: reportBeingFinalized.extension,
});

/**
 * The order's review task, by the same rules the order list uses to decide `final` vs `reviewed` — a
 * radiology review-final-result task for this order that hasn't been cancelled.
 */
export const findRadiologyFinalReviewTask = (tasks: Task[], serviceRequestId: string): Task | undefined =>
  tasks.find(
    (task) =>
      task.status !== 'cancelled' &&
      task.groupIdentifier?.value === RADIOLOGY_TASK.category &&
      !!task.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequestId}`) &&
      !!task.code?.coding?.some(
        (coding) => coding.system === RADIOLOGY_TASK.system && coding.code === RADIOLOGY_TASK.code.reviewFinalResultTask
      )
  );

/**
 * `reviewed` is the end of the line: once a provider has signed off on the final read, neither read may be
 * edited. Mirrors the last branch of the order list's status derivation.
 */
export const isRadiologyOrderReviewed = (tasks: Task[], serviceRequestId: string): boolean =>
  findRadiologyFinalReviewTask(tasks, serviceRequestId)?.status === 'completed';

export const getMostRecentReport = (reports: DiagnosticReport[]): DiagnosticReport | undefined => {
  if (!reports.length) return undefined;

  return reports.reduce((mostRecent, current) => {
    if (!current.issued) return mostRecent;
    if (!mostRecent.issued) return current;

    return new Date(current.issued) > new Date(mostRecent.issued) ? current : mostRecent;
  });
};

export const takeMostRecentPreliminaryReport = (
  diagnosticReports: DiagnosticReport[]
): DiagnosticReport | undefined => {
  if (!diagnosticReports.length) {
    return undefined;
  }

  const preliminaryReports = diagnosticReports.filter((report) => report.status === 'preliminary');

  return getMostRecentReport(preliminaryReports);
};

export const takeTheBestFinalDiagnosticReport = (
  diagnosticReports: DiagnosticReport[]
): DiagnosticReport | undefined => {
  if (!diagnosticReports.length) {
    return undefined;
  }

  // Filter reports by status priority
  const amendedCorrectedAppended = diagnosticReports.filter(
    (report) => report.status === 'amended' || report.status === 'corrected' || report.status === 'appended'
  );

  const finalReports = diagnosticReports.filter((report) => report.status === 'final');

  // Apply priority logic
  if (amendedCorrectedAppended.length > 0) {
    return getMostRecentReport(amendedCorrectedAppended);
  } else if (finalReports.length > 0) {
    return getMostRecentReport(finalReports);
  }

  return undefined;
};

export const makeRadiologyDTO = (
  serviceRequest: ServiceRequest,
  preliminaryDiagnosticReport?: DiagnosticReport,
  finalDiagnosticReport?: DiagnosticReport
): RadiologyDTO => {
  const cptCode = serviceRequest.code?.coding?.[0]?.code ?? '';

  // The SR code embeds laterality as a `<cpt>-<modifier>` suffix; split it back out, deriving the
  // modifier alternation from the canonical selectors so it stays in sync if modifiers change.
  const lateralitySuffix = new RegExp(`-(${Object.keys(LATERALITY_SELECTORS).join('|')})$`);
  const lateralityMatch = lateralitySuffix.exec(cptCode);
  const laterality = lateralityMatch ? (lateralityMatch[1] as LateralityValue) : undefined;
  const baseCptCode = laterality ? cptCode.slice(0, -(laterality.length + 1)) : cptCode;

  const diagnoses = (serviceRequest.reasonCode ?? []).map((reason) => ({
    code: reason.coding?.[0]?.code ?? '',
    display: reason.coding?.[0]?.display ?? '',
  }));
  const diagnosis = diagnoses.map(({ code, display }) => `${code} — ${display}`).join('; ');

  const cptCodeDisplay = serviceRequest.code?.coding?.[0]?.display ?? '';

  const preliminaryReportData = preliminaryDiagnosticReport?.presentedForm?.find(
    (attachment) => attachment.contentType === 'text/html'
  )?.data;

  const finalReportData = finalDiagnosticReport?.presentedForm?.find(
    (attachment) => attachment.contentType === 'text/html'
  )?.data;

  const clinicalHistory = extractOrderDetailValue(serviceRequest, 'clinical-history');
  const studyName = extractOrderDetailValue(serviceRequest, 'requested-procedure-description');

  const findExt = (url: string): Extension | undefined => serviceRequest.extension?.find((ext) => ext.url === url);

  const external = findExt(FHIR_EXTENSION.ServiceRequest.externalRadiologyOrder.url)?.valueBoolean;
  const timeWindow = findExt(FHIR_EXTENSION.ServiceRequest.radiologyTimeWindow.url)?.valueString;
  const safetyFlags = serviceRequest.extension
    ?.filter((ext) => ext.url === FHIR_EXTENSION.ServiceRequest.radiologySafetyFlag.url)
    .map((ext) => ext.valueCode)
    .filter((code): code is RadiologySafetyFlag => code != null);

  const performingOrganization = extractPerformingOrganization(serviceRequest);
  const performedBy = extractPerformedBy(serviceRequest);

  const dto: RadiologyDTO = {
    serviceRequestId: serviceRequest.id!,
    cptCodeDisplay,
    cptCode: baseCptCode,
    laterality,
    studyType: `${baseCptCode} — ${cptCodeDisplay}`,
    diagnosis,
    diagnoses,
    clinicalHistory,
    preliminaryReport: preliminaryReportData,
    finalReport: finalReportData,
    studyName,
    external: external || undefined,
    performingOrganization,
    timeWindow,
    safetyFlags: safetyFlags && safetyFlags.length > 0 ? safetyFlags : undefined,
    performedBy,
  };

  return dto;
};

const extractPerformedBy = (serviceRequest: ServiceRequest): RadiologyPerformedBy | undefined => {
  const performer = serviceRequest.performer?.find((ref) => ref.reference?.startsWith('Practitioner/'));
  const id = performer?.reference?.split('/')[1];
  if (!id) {
    return undefined;
  }
  // `display` is written from the Practitioner's name; fall back to the id rather than rendering nothing.
  return { id, name: performer?.display || id };
};

const extractPerformingOrganization = (serviceRequest: ServiceRequest): RadiologyPerformingOrganization | undefined => {
  const org = serviceRequest.contained?.find(
    (resource): resource is Organization =>
      resource.resourceType === 'Organization' && resource.id === RADIOLOGY_PERFORMING_ORGANIZATION_CONTAINED_ID
  );
  if (!org) {
    return undefined;
  }
  return {
    name: org.name,
    address: org.address?.[0]?.text,
    phone: org.telecom?.find((t) => t.system === 'phone')?.value,
    fax: org.telecom?.find((t) => t.system === 'fax')?.value,
  };
};

const extractOrderDetailValue = (serviceRequest: ServiceRequest, code: string): string | undefined => {
  const matchingExtension = serviceRequest.extension
    ?.filter((ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL)
    ?.find((orderDetailExt) => {
      const parameterExt = orderDetailExt.extension?.find(
        (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL
      );
      const codeExt = parameterExt?.extension?.find(
        (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL
      );
      return codeExt?.valueCodeableConcept?.coding?.[0]?.code === code;
    });

  const parameterExt = matchingExtension?.extension?.find(
    (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL
  );
  const valueStringExt = parameterExt?.extension?.find(
    (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL
  );

  return valueStringExt?.valueString;
};
