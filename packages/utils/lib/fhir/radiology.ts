import Oystehr from '@oystehr/sdk';
import { DiagnosticReport, Reference, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getSecret, Secrets, SecretsKeys } from '../secrets';
import { SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL } from './constants';
import { getScheduleOwnerFromAppointmentOrEncounter } from './helpers';

// cSpell:ignore: ACSN, PLAC
/** contained-resource id for the free-text performing organization on an external radiology order */
export const RADIOLOGY_PERFORMING_ORGANIZATION_CONTAINED_ID = 'performing-organization';
/** Identifier system for the contained performing organization, stamped so it satisfies org-1 even with no name. */
export const RADIOLOGY_PERFORMING_ORGANIZATION_IDENTIFIER_SYSTEM =
  'https://fhir.ottehr.com/Identifier/radiology-performing-organization';
/** DocumentReference type coding for manually-attached radiology result files (external orders) */
export const RADIOLOGY_RESULT_DOC_REF_DOCTYPE = {
  system: 'http://ottehr.org/fhir/StructureDefinition/radiology-result',
  code: 'radiology-result',
  display: 'Radiology Result',
};
export const ADVAPACS_FHIR_BASE_URL = 'https://usa1.api.integration.advapacs.com/fhir/R5';
export const ADVAPACS_VIEWER_LAUNCH_URL = 'https://usa1.api.integration.advapacs.com/viewer/launch';
export const ORDER_TYPE_CODE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/order-type-tag';
export const HL7_IDENTIFIER_TYPE_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0203';
export const HL7_IDENTIFIER_TYPE_CODE_SYSTEM_ACCESSION_NUMBER = 'ACSN';
export const HL7_IDENTIFIER_TYPE_CODE_SYSTEM_PLACER_ORDER_NUMBER = 'PLAC';
export const HL7_IDENTIFIER_TYPE_CODE_SYSTEM_FILLER_ORDER_NUMBER = 'FILL';
export const ACCESSION_NUMBER_CODE_SYSTEM = 'https://fhir.ottehr.com/Identifier/accession-number';
export const PLACER_ORDER_NUMBER_CODE_SYSTEM = 'https://fhir.ottehr.com/Identifier/placer-order-number';
export const FILLER_ORDER_NUMBER_CODE_SYSTEM = 'https://fhir.ottehr.com/Identifier/filler-order-number';
export const ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/advapacs-fhir-resource-id';
export const DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL =
  'https://fhir.ottehr.com/Extension/diagnostic-report-preliminary-review-on';
export const SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL =
  'https://fhir.ottehr.com/Extension/service-request-performed-on';
export const SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL =
  'https://fhir.ottehr.com/Extension/service-request-requested-time';
export const SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL =
  'https://fhir.ottehr.com/Extension/service-request-order-detail-pre-release';
export const SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL =
  'https://fhir.ottehr.com/Extension/service-request-order-detail-parameter-pre-release';
export const SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL =
  'https://fhir.ottehr.com/Extension/service-request-order-detail-parameter-pre-release-code';
export const SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL =
  'https://fhir.ottehr.com/Extension/service-request-order-detail-parameter-pre-release-value-string';
export const SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL =
  'https://fhir.ottehr.com/Extension/service-request-needs-to-be-sent-to-teleradiology';
export const SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL =
  'https://fhir.ottehr.com/Extension/service-request-has-been-sent-to-teleradiology';
/**
 * The practitioner who sent the order for a final read, recorded alongside the timestamp extension rather
 * than inside it: FHIR forbids an extension carrying both a value and nested extensions.
 */
export const SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL =
  'https://fhir.ottehr.com/Extension/service-request-sent-for-final-read-by';

/*
 * Reads are stored on `DiagnosticReport.presentedForm` as base64-encoded `text/html`. What the EHR writes is
 * plain text with newlines turned into `<br>`; what comes back from AdvaPACS is the radiologist's own markup.
 * Both halves of the format live here so the round-trip stays in one place — the zambdas encode, the EHR
 * decodes, as markup for display or as text for editing.
 */

export const encodeRadiologyReport = (report: string): string =>
  Buffer.from(report.replace(/\n/g, '<br>')).toString('base64');

/** `atob` yields one character per byte, so decode the bytes as UTF-8 or non-ASCII reads come back mangled. */
const decodeBase64Utf8 = (value: string): string =>
  new TextDecoder().decode(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)));

/**
 * Reads a stored report back as the `text/html` it was stored as. A read from AdvaPACS carries the
 * radiologist's own formatting (italicised findings, paragraphs) and is displayed as sent, so callers must
 * sanitize before rendering it — see `safeRadiologyReportHtml` in the EHR.
 */
export const decodeRadiologyReportHtml = (report: string): string => {
  try {
    return decodeBase64Utf8(report);
  } catch {
    // Not base64: show what we were given rather than blanking the read.
    return report;
  }
};

/**
 * The same report as plain text, for seeding the edit field — a textarea can't hold markup, and the reads
 * that are editable are ones we wrote ourselves as text with `<br>` line breaks.
 */
export const decodeRadiologyReportText = (report: string): string => {
  const html = decodeRadiologyReportHtml(report);

  // `<br>` is the line break we write; `</p>` covers paragraphs a teleradiology report may arrive with.
  const withLineBreaks = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p\s*>/gi, '\n');

  return new DOMParser().parseFromString(withLineBreaks, 'text/html').body.textContent ?? withLineBreaks;
};

// do not adjust modifierDescription, this is mapped to fhir resources
export const LATERALITY_SELECTORS = {
  '50': {
    modifierDescription: 'Bilateral Procedure',
    uiDisplay: 'Both sides - bilateral',
  },
  LT: {
    modifierDescription: 'Left side',
    uiDisplay: 'Left side',
  },
  RT: {
    modifierDescription: 'Right side',
    uiDisplay: 'Right side',
  },
} as const;

export type LateralityValue = keyof typeof LATERALITY_SELECTORS;

/**
 * Fetches a ServiceRequest from AdvaPACS using the accession number
 * @param accessionNumber The accession number to search for
 * @param secrets The secrets containing AdvaPACS credentials
 * @returns The ServiceRequest from AdvaPACS
 */
export const fetchServiceRequestFromAdvaPACS = async (
  accessionNumber: string,
  secrets: Secrets
): Promise<ServiceRequest> => {
  const advapacsClientId = getSecret(SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
  const advapacsClientSecret = getSecret(SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
  const advapacsAuthString = `ID=${advapacsClientId},Secret=${advapacsClientSecret}`;

  // Search for the ServiceRequest in AdvaPACS by the accession number
  const findServiceRequestResponse = await fetch(
    `${ADVAPACS_FHIR_BASE_URL}/ServiceRequest?identifier=${ACCESSION_NUMBER_CODE_SYSTEM}%7C${accessionNumber}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/fhir+json',
        Authorization: advapacsAuthString,
      },
    }
  );

  if (!findServiceRequestResponse.ok) {
    throw new Error(
      `AdvaPACS search errored out with statusCode ${findServiceRequestResponse.status}, status text ${
        findServiceRequestResponse.statusText
      }, and body ${JSON.stringify(await findServiceRequestResponse.json(), null, 2)}`
    );
  }

  const maybeAdvaPACSSr = await findServiceRequestResponse.json();

  if (maybeAdvaPACSSr.resourceType !== 'Bundle') {
    throw new Error(`Expected response to be Bundle but got ${maybeAdvaPACSSr.resourceType}`);
  }

  if (maybeAdvaPACSSr.entry.length === 0) {
    throw new Error(`No service request found in AdvaPACS for accession number ${accessionNumber}`);
  }
  if (maybeAdvaPACSSr.entry.length > 1) {
    throw new Error(
      `Found multiple service requests in AdvaPACS for accession number ${accessionNumber}, cannot update.`
    );
  }

  return maybeAdvaPACSSr.entry[0].resource as ServiceRequest;
};

export const createOurDiagnosticReport = async (
  serviceRequest: ServiceRequest,
  pacsDiagnosticReport: DiagnosticReport,
  preliminaryReport: string | undefined,
  oystehr: Oystehr,
  /**
   * Who wrote this read. Kept separate from `ServiceRequest.performer` (who performed the study) so the two
   * can never stand in for each other. Absent for reports arriving from AdvaPACS.
   */
  author?: Reference
): Promise<void> => {
  let preliminaryReportAsBase64: string | undefined = undefined;
  if (preliminaryReport !== undefined) {
    preliminaryReportAsBase64 = encodeRadiologyReport(preliminaryReport);
  }

  const diagnosticReportToCreate: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    status: pacsDiagnosticReport.status,
    subject: serviceRequest.subject,
    basedOn: [
      {
        reference: `ServiceRequest/${serviceRequest.id}`,
      },
    ],
    identifier: [
      {
        system: ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM,
        value: pacsDiagnosticReport.id,
      },
    ],
    code: pacsDiagnosticReport.code ?? {
      // Advapacs does not send a code even though it is required in the FHIR spec
      coding: [
        {
          system: 'http://loinc.org',
          code: '18748-4',
          display: 'Radiology Report',
        },
      ],
    },
    presentedForm: pacsDiagnosticReport.presentedForm ?? [
      {
        contentType: 'text/html',
        data: preliminaryReportAsBase64,
      },
    ],
    ...(author ? { performer: [author] } : {}),
  };

  if (pacsDiagnosticReport.status === 'preliminary') {
    diagnosticReportToCreate.extension = [
      {
        url: DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL,
        valueDateTime: DateTime.now().toISO(),
      },
    ];
  }

  const createResult = await oystehr.fhir.create<DiagnosticReport>(diagnosticReportToCreate);
  console.log('Created our DiagnosticReport: ', JSON.stringify(createResult, null, 2));
};

// Returns undefined if there is no advapacs location registered on the schedule owner
export const getAdvaPACSLocationForAppointmentOrEncounter = async (
  input: { appointmentId?: string; encounterId?: string },
  oystehr: Oystehr
): Promise<string | undefined> => {
  const scheduleOwner = await getScheduleOwnerFromAppointmentOrEncounter(input, oystehr);

  return scheduleOwner.extension?.find((ext) => {
    return ext.url === SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL;
  })?.valueString;
};
