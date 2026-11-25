import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { CodeableConcept, DiagnosticReport as DiagnosticReport4B, ServiceRequest } from 'fhir/r4b';
import { DiagnosticReport, Reference } from 'fhir/r5';
import { FHIR_EXTENSION } from 'utils/lib/fhir/constants';
import { getExtension } from 'utils/lib/fhir/helpers';
import {
  ACCESSION_NUMBER_CODE_SYSTEM,
  ADVAPACS_FHIR_BASE_URL,
  createOurDiagnosticReport,
  encodeRadiologyReport,
  fetchServiceRequestFromAdvaPACS,
} from 'utils/lib/fhir/radiology';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { SaveRadiologyReportZambdaOutput } from 'utils/lib/types/api/radiology';
import { RADIOLOGY_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { resolveCallerPractitionerRef } from '../../../shared/practitioners';
import { savePerformedBy } from '../../../shared/radiology';
import { wrapHandler } from '../../../shared/sentry';
import { settledValueOrThrow } from '../../../shared/settled';
import { ZambdaInput } from '../../../shared/types/common';
import { validateICD10Codes } from '../create-order/validation';
import { extractDiagnosticsFromAdvaPACSErrorBody } from '../shared';
import { finalizeRadiologyReport } from '../shared/finalize-report';
import { ValidatedInput, validateInput, validateSecrets } from './validation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'save-preliminary-report';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const secrets = validateSecrets(unsafeInput.secrets);

  const validatedInput = await validateInput(unsafeInput);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const output = await performEffect(validatedInput, secrets, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify({ output }),
  };
});

async function performEffect(
  validatedInput: ValidatedInput,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<SaveRadiologyReportZambdaOutput> {
  const {
    serviceRequestId,
    report: preliminaryReport,
    diagnosisCodes,
    performedById,
    markAsFinal,
  } = validatedInput.body;

  // Diagnosis is optional at order time but required to save a preliminary read (enforced in
  // validateInput). Validate the ICD-10 codes up front so we fail fast before touching AdvaPACS.
  // The order and author are fetched up front too, so a failure happens before the single-shot AdvaPACS POST.
  console.group('Fetching service request from Oystehr');
  const [diagnosesResult, serviceRequestResult, authorResult, existingReportsResult] = await Promise.allSettled([
    validateICD10Codes(diagnosisCodes, oystehr),
    oystehr.fhir.get<ServiceRequest>({ resourceType: 'ServiceRequest', id: serviceRequestId }),
    resolveCallerPractitionerRef(validatedInput.callerAccessToken, secrets, oystehr),
    searchExistingReports(serviceRequestId, oystehr),
  ]);
  const diagnoses = settledValueOrThrow(diagnosesResult);
  const serviceRequest = settledValueOrThrow(serviceRequestResult);
  const author = settledValueOrThrow(authorResult);
  console.groupEnd();
  console.debug('Service request fetched successfully');

  console.group('Validating the order accepts a preliminary report');
  validateOrderAcceptsPreliminaryReport(serviceRequest, existingReportsResult);
  console.groupEnd();

  // Record who performed the study before writing the report; a report failure downstream then leaves the
  // selection saved for the retry rather than discarding it.
  if (performedById) {
    console.group('Saving performed by on the service request');
    await savePerformedBy(serviceRequest, performedById, oystehr);
    console.groupEnd();
    console.debug('Performed by saved successfully');
  }

  // Extract the accession number from the service request (read-only guard — do this before any
  // write so an order missing its accession fails without a partial mutation).
  const accessionNumber = serviceRequest.identifier?.find(
    (identifier) => identifier.system === ACCESSION_NUMBER_CODE_SYSTEM
  )?.value;

  if (!accessionNumber) {
    throw new Error('No accession number found in service request, cannot save preliminary report to AdvaPACS.');
  }

  // Persist the diagnosis onto the order *before* creating the DiagnosticReport. AdvaPACS report
  // creation is single-shot (a re-attempt is rejected as "already saved"), so if we patched the
  // diagnosis after it and that patch failed, the order would be stranded without a diagnosis and
  // could never be retried. Writing it first makes a failed run safe to re-run: the patch is
  // idempotent (replace) and dedupes on retry, and the report creation still runs afterwards.
  console.group('Updating service request diagnosis in Oystehr');
  const reasonCode: CodeableConcept[] = diagnoses.map((diagnosis) => ({ coding: [diagnosis] }));
  const hasExistingReasonCode = Array.isArray(serviceRequest.reasonCode) && serviceRequest.reasonCode.length > 0;
  const reasonCodeOperation: Operation = hasExistingReasonCode
    ? { op: 'replace', path: '/reasonCode', value: reasonCode }
    : { op: 'add', path: '/reasonCode', value: reasonCode };
  const [reasonCodePatchResult, advaPacsServiceRequestResult] = await Promise.allSettled([
    oystehr.fhir.patch({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
      operations: [reasonCodeOperation],
    }),
    // Fetch the corresponding service request from AdvaPACS using the accession number
    fetchServiceRequestFromAdvaPACS(accessionNumber, secrets),
  ]);
  settledValueOrThrow(reasonCodePatchResult);
  console.groupEnd();
  console.debug('Service request diagnosis updated successfully');

  const advaPacsServiceRequest = settledValueOrThrow(advaPacsServiceRequestResult);
  console.debug('AdvaPACS service request fetched successfully');

  // Create a DiagnosticReport in AdvaPACS with the preliminary report
  console.group('Creating DiagnosticReport in AdvaPACS');
  const advaPacsDiagnosticReport = await createDiagnosticReportInAdvaPACS(
    advaPacsServiceRequest,
    preliminaryReport,
    secrets
  );
  console.groupEnd();
  console.debug('DiagnosticReport created successfully in AdvaPACS');

  // Credited to whoever wrote it — the report's own author, distinct from `ServiceRequest.performer` (who
  // performed the study), so the "preliminary" and "performed" history rows never read the same field.
  console.group('Creating DiagnosticReport in Oystehr');
  await createOurDiagnosticReport(serviceRequest, advaPacsDiagnosticReport, preliminaryReport, oystehr, author);
  console.groupEnd();
  console.debug('DiagnosticReport created successfully in Oystehr');

  if (markAsFinal) {
    console.group('Marking the preliminary report as final');
    try {
      await finalizeRadiologyReport(serviceRequestId, preliminaryReport, async () => author, oystehr);
    } catch (error) {
      console.error('Failed to mark the preliminary report as final', error);
      throw RADIOLOGY_ERROR(
        'The preliminary read was saved but could not be marked as final. Please save it as the final read again.'
      );
    } finally {
      console.groupEnd();
    }
  }

  return {};
}

const searchExistingReports = async (serviceRequestId: string, oystehr: Oystehr): Promise<DiagnosticReport4B[]> =>
  (
    await oystehr.fhir.search<DiagnosticReport4B>({
      resourceType: 'DiagnosticReport',
      params: [{ name: 'based-on', value: `ServiceRequest/${serviceRequestId}` }],
    })
  )
    .unbundle()
    .filter((report) => report.status !== 'entered-in-error');

/**
 * In-house, performed, not yet reported — checked here because the performer patch below runs before AdvaPACS
 * gets a chance to reject a duplicate report, and would rewrite an already-locked `performer`.
 */
const validateOrderAcceptsPreliminaryReport = (
  serviceRequest: ServiceRequest,
  existingReportsResult: PromiseSettledResult<DiagnosticReport4B[]>
): void => {
  const isExternal = !!getExtension(serviceRequest, FHIR_EXTENSION.ServiceRequest.externalRadiologyOrder.url)
    ?.valueBoolean;
  if (isExternal) {
    throw RADIOLOGY_ERROR('External radiology orders cannot have a preliminary report.');
  }

  // `completed` is what the order list reads as the `performed` status.
  if (serviceRequest.status !== 'completed') {
    throw RADIOLOGY_ERROR('This study has not been performed yet, a preliminary report cannot be saved.');
  }

  const existingReports = settledValueOrThrow(existingReportsResult);
  if (existingReports.length > 0) {
    throw RADIOLOGY_ERROR('This report has already been saved, please refresh the page.');
  }
};

/**
 * Creates a DiagnosticReport in AdvaPACS for a ServiceRequest with preliminary findings
 * @param advaPacsServiceRequestId The ServiceRequest ID in AdvaPACS
 * @param preliminaryReport The preliminary report text
 * @param secrets The secrets containing AdvaPACS credentials
 * @returns The created DiagnosticReport
 */
const createDiagnosticReportInAdvaPACS = async (
  advaPacsServiceRequest: ServiceRequest,
  preliminaryReport: string,
  secrets: Secrets
): Promise<any> => {
  const advapacsClientId = getSecret(SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
  const advapacsClientSecret = getSecret(SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
  const advapacsAuthString = `ID=${advapacsClientId},Secret=${advapacsClientSecret}`;

  const reportAsBase64 = encodeRadiologyReport(preliminaryReport);
  const reportAsBase64Size = Buffer.byteLength(reportAsBase64);

  const diagnosticReport: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    status: 'preliminary',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
            code: 'RAD',
            display: 'Radiology',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '18748-4',
          display: 'Diagnostic imaging study',
        },
      ],
    },
    basedOn: [
      {
        reference: `ServiceRequest/${advaPacsServiceRequest.id}`,
      },
    ],
    subject: advaPacsServiceRequest.subject as Reference,
    presentedForm: [
      {
        contentType: 'text/html',
        data: reportAsBase64,
        size: `${reportAsBase64Size}`,
      },
    ],
  };

  const response = await fetch(`${ADVAPACS_FHIR_BASE_URL}/DiagnosticReport`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/fhir+json',
      Authorization: advapacsAuthString,
    },
    body: JSON.stringify(diagnosticReport),
  });
  const body = await response.json();

  if (!response.ok) {
    if (response.status === 422) {
      const alreadySentDiagnosticsMsg = 'The ServiceRequest is already linked to a different DiagnosticReport';
      const diagnostics = extractDiagnosticsFromAdvaPACSErrorBody(body);
      if (diagnostics === alreadySentDiagnosticsMsg) {
        throw RADIOLOGY_ERROR('This report has already been saved, please refresh the page.');
      }
    }

    throw new Error(
      `AdvaPACS DiagnosticReport creation errored out with statusCode ${response.status}, status text ${
        response.statusText
      }, and body ${JSON.stringify(body, null, 2)}`
    );
  }

  return body;
};
