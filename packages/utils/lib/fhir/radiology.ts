import Oystehr, { SearchParam } from '@oystehr/sdk';
import {
  Appointment,
  DiagnosticReport,
  HealthcareService,
  Location,
  Practitioner,
  Schedule,
  ServiceRequest,
  Slot,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  getSecret,
  SCHEDULE_NOT_FOUND_ERROR,
  SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL,
  Secrets,
  SecretsKeys,
} from 'utils';

// cSpell:ignore: ACSN, PLAC
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
  oystehr: Oystehr
): Promise<void> => {
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
    presentedForm: pacsDiagnosticReport.presentedForm,
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
  const { appointmentId, encounterId } = input;
  const appointmentSearchParams: SearchParam[] = [
    {
      name: '_include',
      value: 'Appointment:actor',
    },
    {
      name: '_include',
      value: 'Appointment:slot',
    },
    {
      name: '_include:iterate',
      value: 'Slot:schedule',
    },
    {
      name: '_revinclude:iterate',
      value: 'Schedule:actor:Location',
    },
    {
      name: '_revinclude:iterate',
      value: 'Schedule:actor:Practitioner',
    },
  ];

  if (appointmentId) {
    appointmentSearchParams.push({
      name: '_id',
      value: appointmentId,
    });
  } else if (encounterId) {
    appointmentSearchParams.push({ name: '_has:Encounter:appointment:_id', value: encounterId });
  } else {
    throw new Error('Either appointmentId or encounterId must be provided');
  }

  const allResources = (
    await oystehr.fhir.search<Appointment | Slot | Schedule | Location | HealthcareService | Practitioner>({
      resourceType: 'Appointment',
      params: appointmentSearchParams,
    })
  ).unbundle();
  console.log(`successfully retrieved ${allResources.length} appointment resources`);
  const fhirAppointment = allResources.find((resource) => resource.resourceType === 'Appointment') as Appointment;
  const fhirLocation = allResources.find((resource) => resource.resourceType === 'Location');
  const fhirHS = allResources.find((resource) => resource.resourceType === 'HealthcareService');
  const fhirPractitioner = allResources.find((resource) => resource.resourceType === 'Practitioner');

  let scheduleOwner: Location | HealthcareService | Practitioner | undefined;
  if (fhirLocation) {
    scheduleOwner = fhirLocation as Location;
  } else if (fhirHS) {
    scheduleOwner = fhirHS as HealthcareService;
  } else if (fhirPractitioner) {
    scheduleOwner = fhirPractitioner as Practitioner;
  }

  if (!fhirAppointment) {
    throw APPOINTMENT_NOT_FOUND_ERROR;
  }

  if (!scheduleOwner) {
    throw SCHEDULE_NOT_FOUND_ERROR;
  }

  const advaPACSLocationFromScheduleOwner = scheduleOwner.extension?.find((ext) => {
    return ext.url === SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL;
  })?.valueString;

  if (advaPACSLocationFromScheduleOwner) {
    return advaPACSLocationFromScheduleOwner;
  }

  return undefined;
};
