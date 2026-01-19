import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getInPersonVisitStatus,
  getSecret,
  getVisitStatusHistory,
  isInPersonAppointment,
  LocationKpiMetrics,
  OTTEHR_MODULE,
  PracticeKpisReportZambdaOutput,
  SecretsKeys,
  VisitStatusHistoryEntry,
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

const ZAMBDA_NAME = 'practice-kpis-report';

// Helper function to get time spent in "arrived" status (with fallback to "ready" or "intake")
// Returns duration in minutes, or null if the status was never entered
function getArrivedDuration(visitStatusHistory: VisitStatusHistoryEntry[]): number | null {
  // Try to find the most recent "arrived" status entry
  let arrivedEntry = visitStatusHistory.findLast((entry) => entry.status === 'arrived');

  // Fallback to "ready" if no "arrived" found
  if (!arrivedEntry) {
    arrivedEntry = visitStatusHistory.findLast((entry) => entry.status === 'ready');
  }

  // Fallback to "intake" if no "ready" found
  if (!arrivedEntry) {
    arrivedEntry = visitStatusHistory.findLast((entry) => entry.status === 'intake');
  }

  // If no relevant status found, return null
  if (!arrivedEntry) {
    return null;
  }

  // Calculate duration
  const startTime = arrivedEntry.period.start;
  const endTime = arrivedEntry.period.end;

  if (!startTime) {
    return null;
  }

  // If status has ended, calculate duration between start and end
  if (endTime) {
    const duration = DateTime.fromISO(endTime).diff(DateTime.fromISO(startTime), 'minutes').minutes;
    return duration;
  }

  // If status hasn't ended yet (shouldn't happen for discharged visits), return null
  return null;
}

// Helper function to get time from "arrived" to discharged status (with fallback to "ready" or "intake")
// Returns total duration in minutes, or null if not calculable
function getArrivedToDischargedDuration(visitStatusHistory: VisitStatusHistoryEntry[]): number | null {
  // Find the start time (arrived, ready, or intake)
  let arrivedEntry = visitStatusHistory.findLast((entry) => entry.status === 'arrived');
  if (!arrivedEntry) {
    arrivedEntry = visitStatusHistory.findLast((entry) => entry.status === 'ready');
  }
  if (!arrivedEntry) {
    arrivedEntry = visitStatusHistory.findLast((entry) => entry.status === 'intake');
  }

  if (!arrivedEntry?.period.start) {
    return null;
  }

  // Find the discharge time (discharged, awaiting supervisor approval, or completed)
  const dischargedEntry = visitStatusHistory.findLast(
    (entry) =>
      entry.status === 'discharged' || entry.status === 'awaiting supervisor approval' || entry.status === 'completed'
  );

  if (!dischargedEntry?.period.start) {
    return null;
  }

  // Calculate duration from arrived to discharged
  const duration = DateTime.fromISO(dischargedEntry.period.start).diff(
    DateTime.fromISO(arrivedEntry.period.start),
    'minutes'
  ).minutes;

  return duration;
}

// Helper function to get time from "arrived" to "intake" status (or later status as backstop)
// Returns total duration in minutes, or null if not calculable
function getTimeToIntake(visitStatusHistory: VisitStatusHistoryEntry[]): number | null {
  // Find the start time (arrived, ready, or intake)
  let arrivedEntry = visitStatusHistory.findLast((entry) => entry.status === 'arrived');
  if (!arrivedEntry) {
    arrivedEntry = visitStatusHistory.findLast((entry) => entry.status === 'ready');
  }
  if (!arrivedEntry) {
    arrivedEntry = visitStatusHistory.findLast((entry) => entry.status === 'intake');
  }

  if (!arrivedEntry?.period.start) {
    return null;
  }

  // Find intake or the next status in progression (ready for provider, provider, discharged, etc.)
  const intakeEntry = visitStatusHistory.findLast(
    (entry) =>
      entry.status === 'intake' ||
      entry.status === 'ready for provider' ||
      entry.status === 'provider' ||
      entry.status === 'discharged' ||
      entry.status === 'awaiting supervisor approval' ||
      entry.status === 'completed'
  );

  if (!intakeEntry?.period.start) {
    return null;
  }

  // Calculate duration from arrived to intake (or later)
  const duration = DateTime.fromISO(intakeEntry.period.start).diff(
    DateTime.fromISO(arrivedEntry.period.start),
    'minutes'
  ).minutes;

  return duration;
}

// Helper function to get time from "arrived" to "provider" status (or later status as backstop)
// Returns total duration in minutes, or null if not calculable
function getTimeToProvider(visitStatusHistory: VisitStatusHistoryEntry[]): number | null {
  // Find the start time (arrived, ready, or intake)
  let arrivedEntry = visitStatusHistory.findLast((entry) => entry.status === 'arrived');
  if (!arrivedEntry) {
    arrivedEntry = visitStatusHistory.findLast((entry) => entry.status === 'ready');
  }
  if (!arrivedEntry) {
    arrivedEntry = visitStatusHistory.findLast((entry) => entry.status === 'intake');
  }

  if (!arrivedEntry?.period.start) {
    return null;
  }

  // Find provider or the next status in progression (discharged, etc.)
  const providerEntry = visitStatusHistory.findLast(
    (entry) =>
      entry.status === 'provider' ||
      entry.status === 'discharged' ||
      entry.status === 'awaiting supervisor approval' ||
      entry.status === 'completed'
  );

  if (!providerEntry?.period.start) {
    return null;
  }

  // Calculate duration from arrived to provider (or later)
  const duration = DateTime.fromISO(providerEntry.period.start).diff(
    DateTime.fromISO(arrivedEntry.period.start),
    'minutes'
  ).minutes;

  return duration;
}

// Helper function to calculate median from array of numbers
function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    // Even number of values - return average of two middle values
    return (sorted[middle - 1] + sorted[middle]) / 2;
  } else {
    // Odd number of values - return middle value
    return sorted[middle];
  }
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let validatedParameters;
  try {
    validatedParameters = validateRequestParameters(input);
    const { dateRange } = validatedParameters;

    // Get M2M token for FHIR access
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);

    console.log('Searching for appointments in date range:', dateRange);

    // First, fetch all locations
    console.log('Fetching all locations...');
    let allLocations: Location[] = [];
    let locationOffset = 0;
    const locationPageSize = 100;

    let locationSearchBundle = await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        { name: '_count', value: locationPageSize.toString() },
        { name: '_offset', value: locationOffset.toString() },
      ],
    });

    let locationResources = locationSearchBundle.unbundle();
    allLocations = allLocations.concat(locationResources);
    console.log(`Fetched ${locationResources.length} locations`);

    // Follow pagination for locations
    while (locationSearchBundle.link?.find((link) => link.relation === 'next')) {
      locationOffset += locationPageSize;
      locationSearchBundle = await oystehr.fhir.search<Location>({
        resourceType: 'Location',
        params: [
          { name: '_count', value: locationPageSize.toString() },
          { name: '_offset', value: locationOffset.toString() },
        ],
      });

      locationResources = locationSearchBundle.unbundle();
      allLocations = allLocations.concat(locationResources);
      console.log(`Fetched ${locationResources.length} more locations (total: ${allLocations.length})`);
    }

    console.log(`Total locations found: ${allLocations.length}`);

    // Now fetch appointments with encounters and locations
    let allResources: (Appointment | Location | Encounter)[] = [];
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
        value: OTTEHR_MODULE.IP, // Only in-person appointments
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

    let searchBundle = await oystehr.fhir.search<Appointment | Location | Encounter>({
      resourceType: 'Appointment',
      params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
    });

    let pageCount = 1;
    console.log(`Fetching page ${pageCount} of appointments and encounters...`);

    let pageResources = searchBundle.unbundle();
    allResources = allResources.concat(pageResources);
    const pageAppointments = pageResources.filter(
      (resource): resource is Appointment => resource.resourceType === 'Appointment'
    );
    console.log(
      `Page ${pageCount}: Found ${pageResources.length} total resources (${pageAppointments.length} appointments)`
    );

    // Follow pagination
    while (searchBundle.link?.find((link) => link.relation === 'next')) {
      offset += pageSize;
      pageCount++;
      console.log(`Fetching page ${pageCount} of appointments and encounters...`);

      searchBundle = await oystehr.fhir.search<Appointment | Location | Encounter>({
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

      // Safety check
      if (pageCount > 100) {
        console.warn('Reached maximum pagination limit (100 pages). Stopping search.');
        break;
      }
    }

    // Separate resources by type
    const appointments = allResources.filter(
      (resource): resource is Appointment => resource.resourceType === 'Appointment'
    );
    const encounters = allResources.filter((resource): resource is Encounter => resource.resourceType === 'Encounter');

    console.log(
      `Total resources found: ${allResources.length} (${appointments.length} appointments, ${encounters.length} encounters)`
    );

    // Create encounter map for quick lookups
    const encounterMap = new Map<string, Encounter>();
    encounters.forEach((encounter) => {
      const appointmentRef = encounter.appointment?.[0]?.reference;
      if (appointmentRef && encounter.id) {
        encounterMap.set(appointmentRef, encounter);
      }
    });

    // Filter for discharged in-person visits only
    const dischargedStatuses = ['discharged', 'awaiting supervisor approval', 'completed'];

    const dischargedAppointments = appointments.filter((appointment) => {
      if (!appointment.id) return false;

      // Verify it's in-person
      if (!isInPersonAppointment(appointment)) return false;

      const encounter = encounterMap.get(`Appointment/${appointment.id}`);
      if (!encounter) return false;

      const visitStatus = getInPersonVisitStatus(appointment, encounter, true); // Enable supervisor approval flag
      return dischargedStatuses.includes(visitStatus);
    });

    console.log(
      `Filtered to ${dischargedAppointments.length} discharged in-person visits out of ${appointments.length} total appointments`
    );

    // Calculate metrics per location
    const locationMetricsMap = new Map<
      string,
      {
        locationId: string;
        arrivedDurations: number[];
        arrivedToDischargedDurations: number[];
        timeToIntakeDurations: number[];
        timeToProviderDurations: number[];
      }
    >();

    dischargedAppointments.forEach((appointment) => {
      // Get location from appointment
      const participantWithLocation = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Location/'));

      let locationId = 'unknown';
      let locationName = 'Unknown Location';

      if (participantWithLocation?.actor?.reference) {
        locationId = participantWithLocation.actor.reference.replace('Location/', '');
        const location = allLocations.find((loc) => loc.id === locationId);
        locationName = location?.name || 'Unknown Location';
      }

      // Get encounter and calculate metrics
      if (appointment.id) {
        const encounter = encounterMap.get(`Appointment/${appointment.id}`);
        if (encounter) {
          const statusHistory = getVisitStatusHistory(encounter);
          const arrivedDuration = getArrivedDuration(statusHistory);
          const arrivedToDischargedDuration = getArrivedToDischargedDuration(statusHistory);
          const timeToIntake = getTimeToIntake(statusHistory);
          const timeToProvider = getTimeToProvider(statusHistory);

          if (
            arrivedDuration !== null ||
            arrivedToDischargedDuration !== null ||
            timeToIntake !== null ||
            timeToProvider !== null
          ) {
            const currentData = locationMetricsMap.get(locationName) || {
              locationId,
              arrivedDurations: [],
              arrivedToDischargedDurations: [],
              timeToIntakeDurations: [],
              timeToProviderDurations: [],
            };

            if (arrivedDuration !== null) {
              currentData.arrivedDurations.push(arrivedDuration);
            }
            if (arrivedToDischargedDuration !== null) {
              currentData.arrivedToDischargedDurations.push(arrivedToDischargedDuration);
            }
            if (timeToIntake !== null) {
              currentData.timeToIntakeDurations.push(timeToIntake);
            }
            if (timeToProvider !== null) {
              currentData.timeToProviderDurations.push(timeToProvider);
            }
            locationMetricsMap.set(locationName, currentData);
          }
        }
      }
    });

    // Build location metrics array with all locations
    const locationMetrics: LocationKpiMetrics[] = allLocations
      .map((location) => {
        const locationName = location.name || 'Unknown Location';
        const locationId = location.id || 'unknown';
        const metricsData = locationMetricsMap.get(locationName);

        if (metricsData && metricsData.arrivedDurations.length > 0) {
          // Calculate arrived to ready average and median
          const arrivedSum = metricsData.arrivedDurations.reduce((acc, val) => acc + val, 0);
          const arrivedAverage = arrivedSum / metricsData.arrivedDurations.length;
          const arrivedMedian = calculateMedian(metricsData.arrivedDurations);

          // Calculate arrived to discharged average and median
          let arrivedToDischargedAverage: number | null = null;
          let arrivedToDischargedMedian: number | null = null;
          if (metricsData.arrivedToDischargedDurations.length > 0) {
            const dischargedSum = metricsData.arrivedToDischargedDurations.reduce((acc, val) => acc + val, 0);
            arrivedToDischargedAverage =
              Math.round((dischargedSum / metricsData.arrivedToDischargedDurations.length) * 100) / 100;
            arrivedToDischargedMedian = calculateMedian(metricsData.arrivedToDischargedDurations);
            if (arrivedToDischargedMedian !== null) {
              arrivedToDischargedMedian = Math.round(arrivedToDischargedMedian * 100) / 100;
            }
          }

          // Calculate time to intake average and median
          let timeToIntakeAverage: number | null = null;
          let timeToIntakeMedian: number | null = null;
          if (metricsData.timeToIntakeDurations.length > 0) {
            const intakeSum = metricsData.timeToIntakeDurations.reduce((acc, val) => acc + val, 0);
            timeToIntakeAverage = Math.round((intakeSum / metricsData.timeToIntakeDurations.length) * 100) / 100;
            timeToIntakeMedian = calculateMedian(metricsData.timeToIntakeDurations);
            if (timeToIntakeMedian !== null) {
              timeToIntakeMedian = Math.round(timeToIntakeMedian * 100) / 100;
            }
          }

          // Calculate time to provider average and median
          let timeToProviderAverage: number | null = null;
          let timeToProviderMedian: number | null = null;
          if (metricsData.timeToProviderDurations.length > 0) {
            const providerSum = metricsData.timeToProviderDurations.reduce((acc, val) => acc + val, 0);
            timeToProviderAverage = Math.round((providerSum / metricsData.timeToProviderDurations.length) * 100) / 100;
            timeToProviderMedian = calculateMedian(metricsData.timeToProviderDurations);
            if (timeToProviderMedian !== null) {
              timeToProviderMedian = Math.round(timeToProviderMedian * 100) / 100;
            }
          }

          return {
            locationName,
            locationId,
            arrivedToReadyAverage: Math.round(arrivedAverage * 100) / 100,
            arrivedToReadyMedian: arrivedMedian !== null ? Math.round(arrivedMedian * 100) / 100 : null,
            arrivedToDischargedAverage,
            arrivedToDischargedMedian,
            timeToIntakeAverage,
            timeToIntakeMedian,
            timeToProviderAverage,
            timeToProviderMedian,
            visitCount: metricsData.arrivedDurations.length,
          };
        } else {
          // Location has no discharged visits
          return {
            locationName,
            locationId,
            arrivedToReadyAverage: null,
            arrivedToReadyMedian: null,
            arrivedToDischargedAverage: null,
            arrivedToDischargedMedian: null,
            timeToIntakeAverage: null,
            timeToIntakeMedian: null,
            timeToProviderAverage: null,
            timeToProviderMedian: null,
            visitCount: 0,
          };
        }
      })
      .sort((a, b) => a.locationName.localeCompare(b.locationName));

    const response: PracticeKpisReportZambdaOutput = {
      message: `Found ${dischargedAppointments.length} discharged in-person visits across ${locationMetrics.length} locations`,
      locations: locationMetrics,
      dateRange,
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
