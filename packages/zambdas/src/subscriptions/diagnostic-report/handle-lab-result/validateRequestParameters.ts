import { DiagnosticReport } from 'fhir/r4b';
import { ZambdaInput } from '../../../shared/types';
import { ReviewLabResultSubscriptionInput } from '.';
import { ACCEPTED_RESULTS_STATUS } from './helpers';

// Note that this file is copied from BH and needs significant changes
export function validateRequestParameters(input: ZambdaInput): ReviewLabResultSubscriptionInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const diagnosticReport = JSON.parse(input.body);

  if (diagnosticReport.resourceType !== 'DiagnosticReport') {
    throw new Error(`resource parsed should be a DiagnosticReport but was a ${diagnosticReport.resourceType}`);
  }

  if (!diagnosticReport.id)
    throw new Error(`Triggering DiagnosticReport did not have an id. ${JSON.stringify(diagnosticReport)}`);

  if (!ACCEPTED_RESULTS_STATUS.includes(diagnosticReport.status))
    throw new Error(
      `Triggering DiagnosticReport.status was not of expected value: ${ACCEPTED_RESULTS_STATUS.join(',')}. Id: ${
        diagnosticReport.id
      } Status: ${diagnosticReport.status}`
    );

  return {
    diagnosticReport: diagnosticReport as DiagnosticReport,
    secrets: input.secrets,
  };
}
