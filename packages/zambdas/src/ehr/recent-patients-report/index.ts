import { BatchInputGetRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Bundle, Encounter, FhirResource, Location, Patient } from 'fhir/r4b';
import {
  getEmailForIndividual,
  getInPersonVisitStatus,
  getPhoneNumberForIndividual,
  getSecret,
  OTTEHR_MODULE,
  RecentPatientRecord,
  RecentPatientsReportZambdaOutput,
  SecretsKeys,
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

const ZAMBDA_NAME = 'recent-patients-report';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let validatedParameters;
  try {
    validatedParameters = validateRequestParameters(input);
    const { dateRange, locationId } = validatedParameters;

    // Get M2M token for FHIR access
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);

    console.log('Searching for appointments in date range:', dateRange, 'location:', locationId);

    // Search for appointments within the date range
    let allResources: (Appointment | Location | Encounter | Patient)[] = [];
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
        name: '_count',
        value: pageSize.toString(),
      },
    ];

    // Add location filter if provided
    if (locationId) {
      baseSearchParams.push({
        name: 'location',
        value: `Location/${locationId}`,
      });
    }

    let searchBundle = await oystehr.fhir.search<Appointment | Location | Encounter | Patient>({
      resourceType: 'Appointment',
      params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
    });

    let pageCount = 1;
    console.log(`Fetching page ${pageCount} of appointments, patients, encounters, and locations...`);

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
      console.log(`Fetching page ${pageCount} of appointments, patients, encounters, and locations...`);

      searchBundle = await oystehr.fhir.search<Appointment | Location | Encounter | Patient>({
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

    // Separate resources by type
    const appointments = allResources.filter(
      (resource): resource is Appointment => resource.resourceType === 'Appointment'
    );
    const patients = allResources.filter((resource): resource is Patient => resource.resourceType === 'Patient');
    const encounters = allResources.filter((resource): resource is Encounter => resource.resourceType === 'Encounter');
    const locations = allResources.filter((resource): resource is Location => resource.resourceType === 'Location');

    console.log(
      `Total resources found across ${pageCount} pages: ${allResources.length} (${appointments.length} appointments, ${patients.length} patients, ${encounters.length} encounters, ${locations.length} locations)`
    );

    // Create maps for quick lookups
    const patientMap = new Map<string, Patient>();
    patients.forEach((patient) => {
      if (patient.id) {
        patientMap.set(patient.id, patient);
      }
    });

    const encounterMap = new Map<string, Encounter>();
    encounters.forEach((encounter) => {
      const appointmentRef = encounter.appointment?.[0]?.reference;
      if (appointmentRef && encounter.id) {
        encounterMap.set(appointmentRef, encounter);
      }
    });

    const locationMap = new Map<string, Location>();
    locations.forEach((location) => {
      if (location.id) {
        locationMap.set(location.id, location);
      }
    });

    // Filter out cancelled and no show visits
    const activeAppointments = appointments.filter((appointment) => {
      if (!appointment.id) return false;
      const encounter = encounterMap.get(`Appointment/${appointment.id}`);
      if (!encounter) return true; // Keep appointments without encounters
      const visitStatus = getInPersonVisitStatus(appointment, encounter);
      return visitStatus !== 'cancelled' && visitStatus !== 'no show';
    });

    console.log(
      `Filtered appointments: ${appointments.length} total, ${activeAppointments.length} active (excluded ${
        appointments.length - activeAppointments.length
      } cancelled/no show visits)`
    );

    if (activeAppointments.length === 0) {
      const response: RecentPatientsReportZambdaOutput = {
        message: 'No appointments found for the specified date range',
        totalPatients: 0,
        patients: [],
        dateRange,
        locationId,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

    // Group appointments by patient to find most recent visit per patient
    const patientAppointmentsMap = new Map<string, Appointment[]>();

    activeAppointments.forEach((appointment) => {
      const patientRef = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'));
      if (patientRef?.actor?.reference) {
        const patientId = patientRef.actor.reference.replace('Patient/', '');
        const existing = patientAppointmentsMap.get(patientId) || [];
        existing.push(appointment);
        patientAppointmentsMap.set(patientId, existing);
      }
    });

    console.log(`Found ${patientAppointmentsMap.size} unique patients with appointments`);

    // For each patient, check if they had appointments before the date range to determine if new or existing
    console.log('Checking patient history to determine new vs existing status...');

    // Build batch requests for all patient history searches
    const allBatchRequests: BatchInputGetRequest[] = Array.from(patientAppointmentsMap.keys()).map((patientId) => {
      // Don't use URLSearchParams for FHIR date prefixes - it encodes the colons which breaks the search
      const url = `/Appointment?patient=Patient/${patientId}&date=lt${dateRange.start}&_count=1`;

      return {
        method: 'GET',
        url,
      };
    });

    // Log first request URL for debugging
    if (allBatchRequests.length > 0) {
      console.log(`Sample history check URL: ${allBatchRequests[0].url}`);
      console.log(`Date range start for history check: ${dateRange.start}`);
    }

    // Split requests into batches of 50
    const BATCH_SIZE = 50;
    const requestBatches: BatchInputGetRequest[][] = [];
    for (let i = 0; i < allBatchRequests.length; i += BATCH_SIZE) {
      requestBatches.push(allBatchRequests.slice(i, i + BATCH_SIZE));
    }

    console.log(
      `Executing ${allBatchRequests.length} patient history checks in ${requestBatches.length} batch(es) of up to ${BATCH_SIZE}`
    );

    // Execute all batches in parallel
    const allBatchResults = await Promise.all(
      requestBatches.map(async (batchRequests, batchIndex) => {
        console.log(`Executing batch ${batchIndex + 1}/${requestBatches.length} with ${batchRequests.length} requests`);
        return await oystehr.fhir.batch<FhirResource>({
          requests: batchRequests,
        });
      })
    );

    // Process batch results to determine patient history
    const patientHistoryMap = new Map<string, boolean>();
    const patientIds = Array.from(patientAppointmentsMap.keys());

    allBatchResults.forEach((batchResult, batchIndex) => {
      const batchStartIndex = batchIndex * BATCH_SIZE;
      console.log(
        `Processing batch ${batchIndex + 1} results, starting at patient index ${batchStartIndex}, batch has ${
          batchResult.entry?.length || 0
        } entries`
      );

      batchResult.entry?.forEach((entry, entryIndex) => {
        const patientId = patientIds[batchStartIndex + entryIndex];
        const requestUrl = allBatchRequests[batchStartIndex + entryIndex]?.url;
        let hasHistoricalAppointments = false;

        console.log(
          `Entry ${entryIndex}: response status=${entry.response?.status}, outcome.id=${entry.response?.outcome?.id}, resourceType=${entry.resource?.resourceType}, patientId=${patientId}`
        );

        if (
          entry.response?.outcome?.id === 'ok' &&
          entry.resource &&
          entry.resource.resourceType === 'Bundle' &&
          entry.resource.type === 'searchset'
        ) {
          const innerBundle = entry.resource as Bundle;
          hasHistoricalAppointments = (innerBundle.entry?.length ?? 0) > 0;

          console.log(
            `Patient ${patientId} searched with URL: ${requestUrl}, found ${
              innerBundle.entry?.length || 0
            } historical appointment(s), bundle.total=${innerBundle.total}`
          );
        }

        patientHistoryMap.set(patientId, hasHistoricalAppointments);
      });
    });

    console.log(
      `Patient history checks completed. ${
        Array.from(patientHistoryMap.values()).filter(Boolean).length
      } patients with history, ${Array.from(patientHistoryMap.values()).filter((v) => !v).length} without history`
    );

    // Build patient records
    const patientRecords: RecentPatientRecord[] = [];

    for (const [patientId, patientAppointments] of patientAppointmentsMap.entries()) {
      const patient = patientMap.get(patientId);
      if (!patient) {
        console.warn(`Patient ${patientId} not found in patient map, skipping`);
        continue;
      }

      // Sort appointments by date (most recent first)
      const sortedAppointments = patientAppointments.sort((a, b) => {
        const dateA = new Date(a.start || '');
        const dateB = new Date(b.start || '');
        return dateB.getTime() - dateA.getTime();
      });

      const mostRecentAppointment = sortedAppointments[0];
      if (!mostRecentAppointment.id || !mostRecentAppointment.start) {
        continue;
      }

      // Get patient name
      const patientName = patient.name?.[0];
      const firstName = patientName?.given?.[0] || 'Unknown';
      const lastName = patientName?.family || 'Unknown';

      // Get contact information
      const phoneNumber = getPhoneNumberForIndividual(patient) || '';
      const email = getEmailForIndividual(patient) || '';

      // Get service category from appointment
      let serviceCategory = 'Unknown';
      const serviceCategoryCoding = mostRecentAppointment.serviceCategory?.[0]?.coding?.[0];
      if (serviceCategoryCoding) {
        serviceCategory = serviceCategoryCoding.display || serviceCategoryCoding.code || 'Unknown';
      }

      // Determine if patient is new or existing based on historical appointments
      const hasHistoricalAppointments = patientHistoryMap.get(patientId) || false;
      const patientStatus: 'new' | 'existing' = hasHistoricalAppointments ? 'existing' : 'new';

      patientRecords.push({
        patientId,
        firstName,
        lastName,
        phoneNumber,
        email,
        mostRecentVisit: {
          appointmentId: mostRecentAppointment.id,
          date: mostRecentAppointment.start,
          serviceCategory,
        },
        patientStatus,
      });
    }

    // Sort by last name, then first name
    patientRecords.sort((a, b) => {
      const lastNameCompare = a.lastName.localeCompare(b.lastName);
      if (lastNameCompare !== 0) return lastNameCompare;
      return a.firstName.localeCompare(b.firstName);
    });

    const response: RecentPatientsReportZambdaOutput = {
      message: `Found ${patientRecords.length} patients with appointments in the date range`,
      totalPatients: patientRecords.length,
      patients: patientRecords,
      dateRange,
      locationId,
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
