import { DiagnosticReport, Extension, Organization, ServiceRequest } from 'fhir/r4b';
import {
  FHIR_EXTENSION,
  LateralityValue,
  RADIOLOGY_PERFORMING_ORGANIZATION_CONTAINED_ID,
  RadiologyDTO,
  RadiologyPerformingOrganization,
  RadiologySafetyFlag,
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

  // The SR code embeds laterality as a `<cpt>-<modifier>` suffix; split it back out for display/edit.
  const lateralityMatch = /-(LT|RT|50)$/.exec(cptCode);
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

  const dto: RadiologyDTO = {
    serviceRequestId: serviceRequest.id!,
    cptCodeDisplay,
    cptCode: baseCptCode,
    laterality,
    // Laterality is surfaced via its own field; keep it out of studyType so it isn't shown twice.
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
  };

  return dto;
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
