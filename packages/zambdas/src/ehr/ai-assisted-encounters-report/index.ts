import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, DocumentReference, Encounter, Location, Patient, Practitioner } from 'fhir/r4b';
import {
  AiAssistedEncountersReportZambdaInput,
  AiAssistedEncountersReportZambdaOutput,
  getAttendingPractitionerId,
  getInPersonVisitStatus,
  getPatientFirstName,
  getPatientLastName,
  getProviderNameWithProfession,
  getSecret,
  isInPersonAppointment,
  isTelemedAppointment,
  OTTEHR_MODULE,
  Secrets,
  SecretsKeys,
  VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'ai-assisted-encounters-report';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let validatedParameters: AiAssistedEncountersReportZambdaInput & { secrets: Secrets };
  try {
    console.group('validateRequestParameters');
    validatedParameters = validateRequestParameters(input);
    const { dateRange, locationIds, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    // Get M2M token for FHIR access
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.log('Searching for appointments in date range:', dateRange);
    if (locationIds && locationIds.length > 0) {
      console.log('Filtering by locations:', locationIds);
    }

    // Search for appointments within the date range with proper pagination
    // Fetch all appointments, encounters, patients, locations, practitioners, and document references
    let allResources: (Appointment | Encounter | Patient | Location | Practitioner | DocumentReference)[] = [];
    let offset = 0;
    const pageSize = 1000;

    const baseSearchParams = [
      {
        name: 'date',
        value: `ge${dateRange.start}`,
      },
      {
        name: 'date',
        value: `le${dateRange.end}`,
      },
      {
        name: 'status',
        value: 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist',
      },
      {
        name: '_tag',
        value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}`,
      },
      {
        name: '_include',
        value: 'Appointment:patient',
      },
      {
        name: '_include',
        value: 'Appointment:location',
      },
      {
        name: '_revinclude',
        value: 'Encounter:appointment',
      },
      {
        name: '_revinclude:iterate',
        value: 'DocumentReference:encounter',
      },
      {
        name: '_include:iterate',
        value: 'Encounter:participant:Practitioner',
      },
      {
        name: '_sort',
        value: 'date',
      },
      {
        name: '_count',
        value: pageSize.toString(),
      },
    ];

    // Add location filter if provided
    if (locationIds && locationIds.length > 0) {
      baseSearchParams.push({
        name: 'location',
        value: locationIds.map((id) => `Location/${id}`).join(','),
      });
    }

    let searchBundle = await oystehr.fhir.search<
      Appointment | Encounter | Patient | Location | Practitioner | DocumentReference
    >({
      resourceType: 'Appointment',
      params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
    });

    let pageCount = 1;
    console.log(`Fetching page ${pageCount} of AI-assisted encounters...`);

    // Get resources from first page
    let pageResources = searchBundle.unbundle();
    allResources = allResources.concat(pageResources);
    const pageAppointments = pageResources.filter(
      (resource): resource is Appointment => resource.resourceType === 'Appointment'
    );
    console.log(
      `Page ${pageCount}: Found ${pageResources.length} total resources (${pageAppointments.length} appointments)`
    );

    // Follow pagination links to get all pages
    while (searchBundle.link?.find((link) => link.relation === 'next')) {
      offset += pageSize;
      pageCount++;
      console.log(`Fetching page ${pageCount} of AI-assisted encounters...`);

      searchBundle = await oystehr.fhir.search<
        Appointment | Encounter | Patient | Location | Practitioner | DocumentReference
      >({
        resourceType: 'Appointment',
        params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
      });

      pageResources = searchBundle.unbundle();
      allResources = allResources.concat(pageResources);
      const pageAppointmentsCount = pageResources.filter(
        (resource): resource is Appointment => resource.resourceType === 'Appointment'
      ).length;

      console.log(
        `Page ${pageCount}: Found ${pageResources.length} total resources (${pageAppointmentsCount} appointments)`
      );

      // Safety check to prevent infinite loops
      if (pageCount > 100) {
        console.warn('Reached maximum pagination limit (100 pages). Stopping search.');
        break;
      }
    }

    console.log(`Found ${allResources.length} total resources across ${pageCount} pages`);

    // Separate resources by type
    const encounters = allResources.filter((resource): resource is Encounter => resource.resourceType === 'Encounter');
    const appointments = allResources.filter(
      (resource): resource is Appointment => resource.resourceType === 'Appointment'
    );
    const patients = allResources.filter((resource): resource is Patient => resource.resourceType === 'Patient');
    const locations = allResources.filter((resource): resource is Location => resource.resourceType === 'Location');
    const practitioners = allResources.filter(
      (resource): resource is Practitioner => resource.resourceType === 'Practitioner'
    );
    const documentReferences = allResources.filter(
      (resource): resource is DocumentReference => resource.resourceType === 'DocumentReference'
    );

    console.log(
      `Encounters: ${encounters.length}, Appointments: ${appointments.length}, Patients: ${patients.length}, Locations: ${locations.length}, Practitioners: ${practitioners.length}, DocumentReferences: ${documentReferences.length}`
    );

    // Create lookup maps
    const appointmentMap = new Map<string, Appointment>();
    appointments.forEach((apt) => {
      if (apt.id) {
        appointmentMap.set(`Appointment/${apt.id}`, apt);
      }
    });

    const patientMap = new Map<string, Patient>();
    patients.forEach((patient) => {
      if (patient.id) {
        patientMap.set(`Patient/${patient.id}`, patient);
      }
    });

    const locationMap = new Map<string, Location>();
    locations.forEach((location) => {
      if (location.id) {
        locationMap.set(`Location/${location.id}`, location);
      }
    });

    const practitionerMap = new Map<string, Practitioner>();
    practitioners.forEach((practitioner) => {
      if (practitioner.id) {
        practitionerMap.set(practitioner.id, practitioner);
      }
    });

    // Create a map of encounter ID to matching document references
    const encounterDocumentMap = new Map<string, DocumentReference[]>();
    documentReferences.forEach((docRef) => {
      const encounterRef = docRef.context?.encounter?.[0]?.reference;
      if (encounterRef) {
        // Check if the document reference has the matching type
        console.log(`Checking DocumentReference ${docRef.id} for encounter ${encounterRef}`);
        const hasMatchingType = docRef.type?.coding?.some(
          (coding) =>
            VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE.system === coding.system &&
            VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE.code === coding.code
        );
        if (!hasMatchingType) {
          return; // Skip this document reference if it doesn't match the type
        }

        const existing = encounterDocumentMap.get(encounterRef) || [];
        existing.push(docRef);
        encounterDocumentMap.set(encounterRef, existing);
      }
    });

    console.log(`Found ${encounterDocumentMap.size} encounters with matching document references`);

    // Filter encounters to only include those with matching document references
    const aiAssistedEncounters = encounters.filter((encounter) => {
      if (!encounter.id) {
        return false;
      }

      const encounterRef = `Encounter/${encounter.id}`;
      const hasDocuments = encounterDocumentMap.has(encounterRef);

      if (!hasDocuments) {
        return false;
      }

      // Find the corresponding appointment
      const appointmentRef = encounter.appointment?.[0]?.reference;
      const appointment = appointmentRef ? appointmentMap.get(appointmentRef) : undefined;

      if (!appointment) {
        console.log(`No appointment found for encounter ${encounter.id}`);
        return false;
      }

      return true;
    });

    console.log(`Found ${aiAssistedEncounters.length} AI-assisted encounters`);

    // Build the response data
    const encounterItems = aiAssistedEncounters.map((encounter) => {
      const appointmentRef = encounter.appointment?.[0]?.reference;
      const appointment = appointmentRef ? appointmentMap.get(appointmentRef) : undefined;
      const patientRef = encounter.subject?.reference;
      const patient = patientRef ? patientMap.get(patientRef) : undefined;

      // Get location name from Location resource
      const locationRef = appointment?.participant?.find((p) => p.actor?.reference?.startsWith('Location/'))?.actor
        ?.reference;
      const location = locationRef ? locationMap.get(locationRef) : undefined;
      const locationName = location?.name || 'Unknown';
      const locationId = locationRef ? locationRef.replace('Location/', '') : undefined;

      // Get attending practitioner name
      const attendingPractitionerId = getAttendingPractitionerId(encounter);
      const attendingPractitioner = attendingPractitionerId ? practitionerMap.get(attendingPractitionerId) : undefined;
      const attendingProviderName = attendingPractitioner
        ? getProviderNameWithProfession(attendingPractitioner)
        : 'Unknown';
      // Determine visit type based on appointment meta tags
      const visitType = isTelemedAppointment(appointment)
        ? 'Telemed'
        : isInPersonAppointment(appointment)
        ? 'In-Person'
        : 'Unknown';

      const visitStatus = appointment ? getInPersonVisitStatus(appointment, encounter, true) : 'unknown';

      // Determine AI type based on DocumentReference.description
      const encounterRef = `Encounter/${encounter.id}`;
      const encounterDocRefs = encounterRef ? encounterDocumentMap.get(encounterRef) || [] : [];

      const hasAmbientScribe = encounterDocRefs.some(
        (docRef) => docRef.description === 'Summary of visit from audio recording'
      );
      const hasPatientChatbot = encounterDocRefs.some((docRef) => docRef.description === 'Summary of visit from chat');

      let aiType = '';
      if (hasAmbientScribe && hasPatientChatbot) {
        aiType = 'patient HPI chatbot & ambient scribe';
      } else if (hasAmbientScribe) {
        aiType = 'ambient scribe';
      } else if (hasPatientChatbot) {
        aiType = 'patient HPI chatbot';
      }

      return {
        appointmentId: appointment?.id || '',
        patientId: patient?.id || '',
        patientName: patient ? `${getPatientFirstName(patient)} ${getPatientLastName(patient)}`.trim() : 'Unknown',
        dateOfBirth: patient?.birthDate || '',
        visitStatus,
        appointmentStart: appointment?.start || '',
        appointmentEnd: appointment?.end || '',
        location: locationName || 'Unknown',
        locationId,
        attendingProvider: attendingProviderName,
        visitType,
        reason: encounter.reasonCode?.[0]?.text || appointment?.appointmentType?.text || '',
        aiType,
      };
    });

    const response: AiAssistedEncountersReportZambdaOutput = {
      message: `Found ${encounterItems.length} AI-assisted encounters`,
      encounters: encounterItems,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
