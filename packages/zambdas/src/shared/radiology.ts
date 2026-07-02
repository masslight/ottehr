import { DiagnosticReport, ServiceRequest } from 'fhir/r4b';
import {
  RadiologyDTO,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL,
} from 'utils';

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

  const diagnosisCode = serviceRequest.reasonCode?.[0]?.coding?.[0]?.code ?? '';

  const diagnosisDisplay = serviceRequest.reasonCode?.[0]?.coding?.[0]?.display ?? '';

  const cptCodeDisplay = serviceRequest.code?.coding?.[0]?.display ?? '';

  const preliminaryReportData = preliminaryDiagnosticReport?.presentedForm?.find(
    (attachment) => attachment.contentType === 'text/html'
  )?.data;

  const finalReportData = finalDiagnosticReport?.presentedForm?.find(
    (attachment) => attachment.contentType === 'text/html'
  )?.data;

  const clinicalHistory = extractOrderDetailValue(serviceRequest, 'clinical-history');
  const studyName = extractOrderDetailValue(serviceRequest, 'requested-procedure-description');

  const dto: RadiologyDTO = {
    serviceRequestId: serviceRequest.id!,
    cptCodeDisplay,
    studyType: `${cptCode} — ${cptCodeDisplay}`,
    diagnosis: `${diagnosisCode} — ${diagnosisDisplay}`,
    clinicalHistory,
    preliminaryReport: preliminaryReportData,
    finalReport: finalReportData,
    studyName,
  };

  return dto;
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
