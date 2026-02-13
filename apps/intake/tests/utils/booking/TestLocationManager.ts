import { Location, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ResourceHandler } from '../resource-handler';

/**
 * Manages test locations and schedules for e2e booking tests
 *
 * Creates a 24/7 location with an always-open schedule for walk-in tests
 */
export class TestLocationManager {
  private resourceHandler: ResourceHandler;
  private testLocation?: Location;
  private testSchedule?: Schedule;

  constructor() {
    this.resourceHandler = new ResourceHandler();
  }

  /**
   * Initialize the resource handler
   */
  async init(): Promise<void> {
    await this.resourceHandler.initApi();
  }

  /**
   * Create or update a test location with 24/7 schedule
   * This ensures walk-in tests can always run regardless of time
   */
  async ensureAlwaysOpenLocation(): Promise<{ location: Location; schedule: Schedule }> {
    const oystehr = this.resourceHandler.apiClient;
    const processId = process.env.PLAYWRIGHT_SUITE_ID;

    if (!processId) {
      throw new Error('PLAYWRIGHT_SUITE_ID environment variable is not set');
    }

    // Search for existing test location tagged with our process ID
    const existingLocations = await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        {
          name: '_tag',
          value: `${processId}|test-location-24-7`,
        },
      ],
    });

    const existingLocation = existingLocations.unbundle()[0] as Location | undefined;

    if (existingLocation?.id) {
      // Find its schedule
      const existingSchedules = await oystehr.fhir.search<Schedule>({
        resourceType: 'Schedule',
        params: [
          {
            name: 'actor',
            value: `Location/${existingLocation.id}`,
          },
        ],
      });

      const existingSchedule = existingSchedules.unbundle()[0] as Schedule | undefined;

      if (existingSchedule?.id) {
        this.testLocation = existingLocation;
        this.testSchedule = existingSchedule;
        return { location: existingLocation, schedule: existingSchedule };
      }
    }

    // Create new test location
    const location: Location = {
      resourceType: 'Location',
      name: `E2ETestLocation247-${processId}`,
      status: 'active',
      mode: 'instance',
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
              code: 'HOSP',
              display: 'Hospital',
            },
          ],
        },
      ],
      address: {
        line: ['123 Test Street'],
        city: 'Test City',
        state: 'CA',
        postalCode: '90210',
        country: 'US',
      },
      meta: {
        tag: [
          {
            system: processId,
            code: 'test-location-24-7',
            display: 'E2E Test Location 24/7',
          },
        ],
      },
    };

    this.testLocation = await oystehr.fhir.create(location);

    if (!this.testLocation.id) {
      throw new Error('Failed to create test location');
    }

    // Create 24/7 schedule for the location
    const now = DateTime.now().toUTC();
    const oneYearFromNow = now.plus({ years: 1 });

    // Create schedule hours for 24/7 availability
    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      capacity: 10, // High capacity for testing
    }));

    const daySchedule = {
      open: 0,
      close: 23,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours,
    };

    const scheduleConfig = {
      schedule: {
        monday: daySchedule,
        tuesday: daySchedule,
        wednesday: daySchedule,
        thursday: daySchedule,
        friday: daySchedule,
        saturday: daySchedule,
        sunday: daySchedule,
      },
      scheduleOverrides: {},
    };

    const schedule: Schedule = {
      resourceType: 'Schedule',
      active: true,
      actor: [
        {
          reference: `Location/${this.testLocation.id}`,
          display: this.testLocation.name,
        },
      ],
      planningHorizon: {
        start: now.toISO()!,
        end: oneYearFromNow.toISO()!,
      },
      extension: [
        {
          url: 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
          valueString: JSON.stringify(scheduleConfig),
        },
        {
          url: 'http://hl7.org/fhir/StructureDefinition/timezone',
          valueString: 'America/New_York',
        },
      ],
      meta: {
        tag: [
          {
            system: processId,
            code: 'test-schedule-24-7',
            display: 'E2E Test Schedule 24/7',
          },
        ],
      },
    };

    this.testSchedule = await oystehr.fhir.create(schedule);

    if (!this.testSchedule.id) {
      throw new Error('Failed to create test schedule');
    }

    return { location: this.testLocation, schedule: this.testSchedule };
  }

  /**
   * Get the test location name for use in tests
   */
  getLocationName(): string | undefined {
    return this.testLocation?.name;
  }

  /**
   * Get the test location ID
   */
  getLocationId(): string | undefined {
    return this.testLocation?.id;
  }

  /**
   * Cleanup test location and schedule
   */
  async cleanup(): Promise<void> {
    const oystehr = this.resourceHandler.apiClient;

    if (this.testSchedule?.id) {
      try {
        await oystehr.fhir.delete({ resourceType: 'Schedule', id: this.testSchedule.id });
      } catch (error) {
        console.warn('Failed to delete test schedule:', error);
      }
    }

    if (this.testLocation?.id) {
      try {
        await oystehr.fhir.delete({ resourceType: 'Location', id: this.testLocation.id });
      } catch (error) {
        console.warn('Failed to delete test location:', error);
      }
    }
  }
}
