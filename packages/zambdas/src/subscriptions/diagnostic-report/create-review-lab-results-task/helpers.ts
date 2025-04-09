import { DiagnosticReport, Organization, ServiceRequest, Task } from 'fhir/r4b';
import { FHIRSearchResult } from '.';

interface UnpackedResults {
  diagnosticReport: DiagnosticReport;
  serviceRequest: ServiceRequest | undefined;
  tasks: Task[];
  organization: Organization;
}

export const unpackResultsAndValidate = (results: FHIRSearchResult[]): UnpackedResults => {
  const diagnosticReports: DiagnosticReport[] = [];
  const serviceRequests: ServiceRequest[] = [];

  const tasks: Task[] = [];
  const organizations: Organization[] = [];

  results.forEach((res) => {
    if (res.resourceType === 'DiagnosticReport') diagnosticReports.push(res as DiagnosticReport);
    if (res.resourceType === 'ServiceRequest') serviceRequests.push(res as ServiceRequest);
    if (res.resourceType === 'Task') tasks.push(res as Task);
    if (res.resourceType === 'Organization') organizations.push(res as Organization);
  });

  if (!diagnosticReports.length || diagnosticReports.length > 1)
    throw new Error(
      `Expected one DiagnosticReport from FHIR search, got none or many ${JSON.stringify(diagnosticReports)}`
    );

  if (serviceRequests.length > 1)
    throw new Error(`Expected one or no ServiceRequest from FHIR search, got many ${JSON.stringify(serviceRequests)}`);

  if (!organizations.length || organizations.length > 1)
    throw new Error(`Expected one Organization from FHIR search, got none or many ${JSON.stringify(organizations)}`);

  return {
    diagnosticReport: diagnosticReports[0],
    serviceRequest: serviceRequests.length ? serviceRequests[0] : undefined,
    tasks,
    organization: organizations[0],
  };
};
