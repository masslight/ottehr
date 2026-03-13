import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Practitioner } from 'fhir/r4b';
import * as fs from 'fs';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

// Helper to get timezone abbreviation (e.g., "PST", "EST")
function getTimezoneAbbreviation(): string {
  const date = new Date();
  const timeZoneName = date
    .toLocaleDateString('en', {
      day: '2-digit',
      timeZoneName: 'short',
    })
    .slice(4);
  return timeZoneName;
}

// Helper function to validate and parse date in yyyy-mm-dd format
function parseDate(dateString: string, paramName: string): Date {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    throw new Error(`❌ ${paramName} must be in yyyy-mm-dd format (e.g., 2025-11-01)`);
  }

  const date = new Date(dateString + 'T00:00:00.000Z');
  if (isNaN(date.getTime())) {
    throw new Error(`❌ Invalid ${paramName}: ${dateString}`);
  }

  return date;
}

// Helper function to get UTC range for a date string
function getUTCDateRange(startDateString: string, endDateString: string): { start: Date; end: Date } {
  const start = parseDate(startDateString, 'Start date');
  const end = parseDate(endDateString, 'End date');

  // Set start to beginning of day (00:00:00)
  start.setUTCHours(0, 0, 0, 0);

  // Set end to end of day (23:59:59.999)
  end.setUTCHours(23, 59, 59, 999);

  // Validate that start is before or equal to end
  if (start.getTime() > end.getTime()) {
    throw new Error(`❌ Start date (${startDateString}) must be before or equal to end date (${endDateString})`);
  }

  return { start, end };
}

// Interface for encounter with additional info
interface VisitDetails {
  appointment: Appointment;
  encounter: Encounter;
  location: Location;
  practitioner?: Practitioner;
}

// Interface for CSV report data
interface CSVVisitData {
  date: string;
  classification: string;
  status: string;
  provider: string;
  location: string;
}

// Function to generate CSV report from visit details
function generateVisitReport(visitDetails: VisitDetails[], csvFilename: string): void {
  try {
    // Prepare CSV data
    const csvData: CSVVisitData[] = visitDetails.map((visit) => {
      // Format date as yyyy-MMM-dd
      const date = visit.appointment.start
        ? new Date(visit.appointment.start)
            .toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
            })
            .replace(/,/g, '') // Remove commas from date format
        : 'Unknown';

      // Get classification from encounter
      const classification = visit.encounter.class?.display || visit.encounter.class?.code || 'Unknown';

      // Get status from encounter
      const status = visit.encounter.status || 'unknown';

      // Get provider name
      const provider = visit.practitioner?.name?.[0]
        ? `${visit.practitioner.name[0].given?.join(' ') || ''} ${visit.practitioner.name[0].family || ''}`.trim()
        : 'No provider';

      // Get location name
      const location = visit.location.name || 'Unknown location';

      return {
        date,
        classification,
        status,
        provider,
        location,
      };
    });

    console.log(`\n📊 Generating CSV report: ${csvFilename}`);

    // CSV headers
    const headers = ['Date', 'Classification', 'Status', 'Provider', 'Location'];

    // Convert data to CSV format
    const csvRows = [
      headers.join(','), // Header row
      ...csvData.map((row) =>
        [`"${row.date}"`, `"${row.classification}"`, `"${row.status}"`, `"${row.provider}"`, `"${row.location}"`].join(
          ','
        )
      ),
    ];

    // Write CSV file
    const csvContent = csvRows.join('\n');
    fs.writeFileSync(csvFilename, csvContent, 'utf8');

    console.log(`✅ CSV report generated successfully: ${csvFilename}`);
    console.log(`📄 Report contains ${csvData.length} visit records`);

    // Print summary statistics
    const statusCounts = new Map<string, number>();
    const classificationCounts = new Map<string, number>();

    csvData.forEach((row) => {
      statusCounts.set(row.status, (statusCounts.get(row.status) || 0) + 1);
      classificationCounts.set(row.classification, (classificationCounts.get(row.classification) || 0) + 1);
    });

    console.log(`\n📋 Report Summary:`);
    console.log(`\n   By Status:`);
    for (const [status, count] of Array.from(statusCounts.entries()).sort()) {
      console.log(`      ${status.padEnd(15)} ${count} visits`);
    }

    console.log(`\n   By Classification:`);
    for (const [classification, count] of Array.from(classificationCounts.entries()).sort()) {
      console.log(`      ${classification.padEnd(15)} ${count} visits`);
    }
  } catch (error) {
    console.error(`❌ Error generating CSV report:`, error);
    throw error;
  }
}

async function findVisitsBetweenDates(oystehr: Oystehr, startDate: Date, endDate: Date): Promise<VisitDetails[]> {
  try {
    // Search for appointments within the date range
    // Fetch all appointments, locations, encounters, and practitioners with proper FHIR pagination
    let allResources: (Appointment | Location | Encounter | Practitioner)[] = [];
    let offset = 0;
    const pageSize = 1000;

    const baseSearchParams = [
      {
        name: 'date',
        value: `ge${startDate.toISOString()}`,
      },
      {
        name: 'date',
        value: `le${endDate.toISOString()}`,
      },
      {
        name: '_tag',
        value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}`,
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
        name: '_include:iterate',
        value: 'Encounter:participant:Practitioner',
      },
      {
        name: '_count',
        value: pageSize.toString(),
      },
    ];

    let searchBundle = await oystehr.fhir.search<Appointment | Location | Encounter | Practitioner>({
      resourceType: 'Appointment',
      params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
    });

    let pageCount = 1;
    console.log(`Fetching page ${pageCount} of appointments and locations...`);

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
      console.log(`Fetching page ${pageCount} of appointments and locations...`);

      searchBundle = await oystehr.fhir.search<Appointment | Location | Encounter | Practitioner>({
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
    const locations = allResources.filter((resource): resource is Location => resource.resourceType === 'Location');
    const encounters = allResources.filter((resource): resource is Encounter => resource.resourceType === 'Encounter');
    const practitioners = allResources.filter(
      (resource): resource is Practitioner => resource.resourceType === 'Practitioner'
    );

    console.log(
      `Total resources found across ${pageCount} pages: ${allResources.length} (${appointments.length} appointments, ${locations.length} locations, ${encounters.length} encounters, ${practitioners.length} practitioners)`
    );

    // Create maps for quick lookup
    const locationMap = new Map<string, Location>();
    locations.forEach((location) => {
      if (location.id) {
        locationMap.set(location.id, location);
      }
    });

    const encounterMap = new Map<string, Encounter>();
    encounters.forEach((encounter) => {
      if (encounter.id) {
        encounterMap.set(encounter.id, encounter);
      }
    });

    const practitionerMap = new Map<string, Practitioner>();
    practitioners.forEach((practitioner) => {
      if (practitioner.id) {
        practitionerMap.set(practitioner.id, practitioner);
      }
    });

    console.log(`\n🔍 Matching appointments with related resources...`);

    const visitDetails: VisitDetails[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let cancelledCount = 0;

    // For each appointment, find matching location, encounter, and practitioner
    for (const appointment of appointments) {
      // Check if appointment is cancelled
      if (appointment.status === 'cancelled') {
        cancelledCount++;
        console.log(`🚫 Skipping cancelled appointment: Appointment/${appointment.id}`);
        continue;
      }

      // Find location from appointment.participant
      let location: Location | undefined;
      const locationParticipant = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Location/'));
      if (locationParticipant?.actor?.reference) {
        const locationId = locationParticipant.actor.reference.split('/')[1];
        location = locationMap.get(locationId);
      }

      // Find encounter that references this appointment
      let encounter: Encounter | undefined;
      if (appointment.id) {
        encounter = encounters.find(
          (enc) => enc.appointment?.some((appt) => appt.reference === `Appointment/${appointment.id}`)
        );
      }

      // Find practitioner from encounter participants
      let practitioner: Practitioner | undefined;
      if (encounter) {
        const practitionerParticipant = encounter.participant?.find(
          (p) => p.individual?.reference?.startsWith('Practitioner/')
        );
        if (practitionerParticipant?.individual?.reference) {
          const practitionerId = practitionerParticipant.individual.reference.split('/')[1];
          practitioner = practitionerMap.get(practitionerId);
        }
      }

      // Only add if we have all required resources
      if (location && encounter) {
        visitDetails.push({
          appointment,
          encounter,
          location,
          practitioner,
        });
        matchedCount++;
      } else {
        unmatchedCount++;
        console.log(
          `⚠️  Incomplete match for Appointment/${appointment.id}: ` +
            `location=${!!location}, encounter=${!!encounter}, practitioner=${!!practitioner}`
        );
      }
    }

    console.log(`\n✅ Matched ${matchedCount} complete visits`);
    if (cancelledCount > 0) {
      console.log(`🚫 Skipped ${cancelledCount} cancelled appointments`);
    }
    if (unmatchedCount > 0) {
      console.log(`⚠️  ${unmatchedCount} appointments had incomplete data`);
    }

    return visitDetails;
  } catch (error) {
    console.error(`❌ Error fetching encounters:`, error);
    throw error;
  }
}

async function main(): Promise<void> {
  const env = process.argv[2];
  const startDateString = process.argv[3]; // Required: yyyy-mm-dd
  const endDateString = process.argv[4]; // Required: yyyy-mm-dd
  const csvFilenameArg = process.argv[5]; // Optional custom filename

  // If no filename provided, use default
  const csvFilename =
    csvFilenameArg ||
    `${process.env.HOME || '~'}/Downloads/${env}-visit-report-${new Date().toISOString().split('T')[0]}.csv`;

  // Validate required arguments
  if (!env) {
    throw new Error(
      '❌ Environment is required. Usage: npm run script report-provider-visists <env> <start-date> <end-date> [csvFilename]'
    );
  }

  if (!startDateString) {
    throw new Error(
      '❌ Start date is required. Usage: npm run script report-provider-visists <env> <start-date> <end-date> [csvFilename]'
    );
  }

  if (!endDateString) {
    throw new Error(
      '❌ End date is required. Usage: npm run script report-provider-visists <env> <start-date> <end-date> [csvFilename]'
    );
  }

  console.log(
    `\n📅 Processing encounters for date range: ${startDateString} to ${endDateString} (${getTimezoneAbbreviation()})`
  );

  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('❌ Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  // Parse and validate date range
  const { start, end } = getUTCDateRange(startDateString, endDateString);

  // Find all visit details
  const visitDetails = await findVisitsBetweenDates(oystehr, start, end);

  console.log(`\n📊 Visit Summary:`);
  console.log(`   Date Range: ${startDateString} to ${endDateString}`);
  console.log(`   Total complete visits: ${visitDetails.length}`);

  // // Print visit details
  // if (visitDetails.length > 0) {
  //   console.log(`\n📝 Visit Details:\n`);
  //   console.log('='.repeat(180));

  //   for (let i = 0; i < visitDetails.length; i++) {
  //     const { appointment, encounter, location, practitioner } = visitDetails[i];

  //     const appointmentDate = appointment.start
  //       ? new Date(appointment.start).toLocaleString('en-US', {
  //           year: 'numeric',
  //           month: 'short',
  //           day: 'numeric',
  //         })
  //       : 'Unknown date';

  //     const locationName = location.name || 'Unknown location';
  //     const practitionerName = practitioner?.name?.[0]
  //       ? `${practitioner.name[0].given?.join(' ') || ''} ${practitioner.name[0].family || ''}`.trim()
  //       : ' - ';
  //     const encounterStatus = encounter.status || 'unknown';
  //     const encounterClass = encounter.class?.display || encounter.class?.code || 'Unknown';

  //     console.log(
  //       `[${(i + 1).toString().padStart(4)}] ${appointmentDate.padEnd(20)} | ${encounterStatus.padEnd(12)} | ${encounterClass.padEnd(20)} | ${locationName.padEnd(30)} | ${practitionerName.padEnd(30)}`
  //     );
  //   }

  //   console.log('='.repeat(180));

  //   // Generate CSV report
  // }
  generateVisitReport(visitDetails, csvFilename);
}

main()
  .then(() => console.log('\n✅ Encounter report completed'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
