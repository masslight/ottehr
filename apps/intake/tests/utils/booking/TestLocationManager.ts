import { Location, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ResourceHandler } from '../resource-handler';

/**
 * Manages test locations and schedules for e2e booking tests
 *
 * Creates 24/7 locations with schedules for both walk-in and prebook tests
 */
export class TestLocationManager {
  private resourceHandler: ResourceHandler;
  private walkinLocation?: Location;
  private walkinSchedule?: Schedule;
  private prebookInPersonLocation?: Location;
  private prebookInPersonSchedule?: Schedule;
  private prebookVirtualLocation?: Location;
  private prebookVirtualSchedule?: Schedule;

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
        this.walkinLocation = existingLocation;
        this.walkinSchedule = existingSchedule;
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

    this.walkinLocation = await oystehr.fhir.create(location);

    if (!this.walkinLocation.id) {
      throw new Error('Failed to create walk-in test location');
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
      close: 24,
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

    if (!this.walkinLocation?.id) {
      throw new Error('Walk-in location must be created before creating schedule');
    }

    const schedule: Schedule = {
      resourceType: 'Schedule',
      active: true,
      actor: [
        {
          reference: `Location/${this.walkinLocation.id}`,
          display: this.walkinLocation.name,
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

    this.walkinSchedule = await oystehr.fhir.create(schedule);

    if (!this.walkinSchedule.id) {
      throw new Error('Failed to create test schedule');
    }

    if (!this.walkinLocation || !this.walkinSchedule) {
      throw new Error('Walk-in location and schedule must be defined');
    }

    return { location: this.walkinLocation, schedule: this.walkinSchedule };
  }

  /**
   * Get the test location name for use in tests
   */
  getLocationName(): string | undefined {
    return this.walkinLocation?.name;
  }

  /**
   * Get the test location ID
   */
  getLocationId(): string | undefined {
    return this.walkinLocation?.id;
  }

  /**
   * Create a test location for in-person prebook flows with plenty of available slots
   * Creates 8 slots per hour, 24/7 to ensure reliable test execution
   */
  async ensurePrebookInPersonLocationWithSlots(): Promise<{ location: Location; schedule: Schedule }> {
    const oystehr = this.resourceHandler.apiClient;
    const processId = process.env.PLAYWRIGHT_SUITE_ID;

    if (!processId) {
      throw new Error('PLAYWRIGHT_SUITE_ID environment variable is not set');
    }

    // Search for existing prebook in-person test location
    const existingLocations = await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        {
          name: '_tag',
          value: `${processId}|test-location-prebook-in-person`,
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
        this.prebookInPersonLocation = existingLocation;
        this.prebookInPersonSchedule = existingSchedule;
        return { location: existingLocation, schedule: existingSchedule };
      }
    }

    // Create new prebook in-person test location
    const slug = `e2e-test-prebook-in-person-${processId}`.toLowerCase().replace(/\s/g, '-');
    const location: Location = {
      resourceType: 'Location',
      name: `E2ETestLocationPrebook-${processId}`,
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
        line: ['456 Prebook Test Street'],
        city: 'Test City',
        state: 'CA',
        postalCode: '90210',
        country: 'US',
      },
      identifier: [
        {
          system: 'https://fhir.ottehr.com/r4/slug',
          value: slug,
        },
      ],
      meta: {
        tag: [
          {
            system: processId,
            code: 'test-location-prebook',
            display: 'E2E Test Location Prebook',
          },
        ],
      },
    };

    this.prebookInPersonLocation = await oystehr.fhir.create(location);

    if (!this.prebookInPersonLocation.id) {
      throw new Error('Failed to create prebook in-person test location');
    }

    // Create 24/7 schedule with 8 slots per hour
    const now = DateTime.now().toUTC();
    const oneYearFromNow = now.plus({ years: 1 });

    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      capacity: 8, // 8 slots per hour for prebook tests
    }));

    const daySchedule = {
      open: 0,
      close: 24,
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
          reference: `Location/${this.prebookInPersonLocation.id}`,
          display: this.prebookInPersonLocation.name,
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
            code: 'test-schedule-prebook-in-person',
            display: 'E2E Test Schedule Prebook In-Person',
          },
        ],
      },
    };

    this.prebookInPersonSchedule = await oystehr.fhir.create(schedule);

    if (!this.prebookInPersonSchedule.id) {
      throw new Error('Failed to create prebook in-person test schedule');
    }

    return { location: this.prebookInPersonLocation, schedule: this.prebookInPersonSchedule };
  }

  /**
   * Create a test location for virtual prebook flows with plenty of available slots
   * Creates 8 slots per hour, 24/7 to ensure reliable test execution
   * Includes virtual extension to mark location as virtual/telemed
   */
  async ensurePrebookVirtualLocationWithSlots(): Promise<{ location: Location; schedule: Schedule }> {
    const oystehr = this.resourceHandler.apiClient;
    const processId = process.env.PLAYWRIGHT_SUITE_ID;

    if (!processId) {
      throw new Error('PLAYWRIGHT_SUITE_ID environment variable is not set');
    }

    // Search for existing prebook virtual test location
    const existingLocations = await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        {
          name: '_tag',
          value: `${processId}|test-location-prebook-virtual`,
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
        this.prebookVirtualLocation = existingLocation;
        this.prebookVirtualSchedule = existingSchedule;
        return { location: existingLocation, schedule: existingSchedule };
      }
    }

    // Create new prebook virtual test location
    const slug = `e2e-test-prebook-virtual-${processId}`.toLowerCase().replace(/\s/g, '-');
    const location: Location = {
      resourceType: 'Location',
      name: `E2ETestLocationPrebookVirtual-${processId}`,
      status: 'active',
      mode: 'kind',
      address: {
        state: 'CA',
        country: 'US',
      },
      identifier: [
        {
          system: 'https://fhir.ottehr.com/r4/slug',
          value: slug,
        },
      ],
      extension: [
        {
          url: 'https://extensions.fhir.zapehr.com/location-form-pre-release',
          valueCoding: {
            system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
            code: 'vi',
            display: 'Virtual',
          },
        },
        {
          url: 'http://hl7.org/fhir/StructureDefinition/timezone',
          valueString: 'America/Los_Angeles',
        },
      ],
      meta: {
        tag: [
          {
            system: processId,
            code: 'test-location-prebook-virtual',
            display: 'E2E Test Location Prebook Virtual',
          },
        ],
      },
    };

    this.prebookVirtualLocation = await oystehr.fhir.create(location);

    if (!this.prebookVirtualLocation.id) {
      throw new Error('Failed to create prebook virtual test location');
    }

    // Create 24/7 schedule with 8 slots per hour
    const now = DateTime.now().toUTC();
    const oneYearFromNow = now.plus({ years: 1 });

    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      capacity: 8, // 8 slots per hour for prebook tests
    }));

    const daySchedule = {
      open: 0,
      close: 24,
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
          reference: `Location/${this.prebookVirtualLocation.id}`,
          display: this.prebookVirtualLocation.name,
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
          valueString: 'America/Los_Angeles',
        },
      ],
      meta: {
        tag: [
          {
            system: processId,
            code: 'test-schedule-prebook-virtual',
            display: 'E2E Test Schedule Prebook Virtual',
          },
        ],
      },
    };

    this.prebookVirtualSchedule = await oystehr.fhir.create(schedule);

    if (!this.prebookVirtualSchedule.id) {
      throw new Error('Failed to create prebook virtual test schedule');
    }

    return { location: this.prebookVirtualLocation, schedule: this.prebookVirtualSchedule };
  }

  /**
   * Cleanup test location and schedule
   */
  async cleanup(): Promise<void> {
    const oystehr = this.resourceHandler.apiClient;

    // Clean up walk-in location
    if (this.walkinSchedule?.id) {
      try {
        await oystehr.fhir.delete({ resourceType: 'Schedule', id: this.walkinSchedule.id });
      } catch (error) {
        console.warn('Failed to delete walk-in test schedule:', error);
      }
    }

    if (this.walkinLocation?.id) {
      try {
        await oystehr.fhir.delete({ resourceType: 'Location', id: this.walkinLocation.id });
      } catch (error) {
        console.warn('Failed to delete walk-in test location:', error);
      }
    }

    // Clean up prebook in-person location
    if (this.prebookInPersonSchedule?.id) {
      try {
        await oystehr.fhir.delete({ resourceType: 'Schedule', id: this.prebookInPersonSchedule.id });
      } catch (error) {
        console.warn('Failed to delete prebook in-person test schedule:', error);
      }
    }

    if (this.prebookInPersonLocation?.id) {
      try {
        await oystehr.fhir.delete({ resourceType: 'Location', id: this.prebookInPersonLocation.id });
      } catch (error) {
        console.warn('Failed to delete prebook in-person test location:', error);
      }
    }

    // Clean up prebook virtual location
    if (this.prebookVirtualSchedule?.id) {
      try {
        await oystehr.fhir.delete({ resourceType: 'Schedule', id: this.prebookVirtualSchedule.id });
      } catch (error) {
        console.warn('Failed to delete prebook virtual test schedule:', error);
      }
    }

    if (this.prebookVirtualLocation?.id) {
      try {
        await oystehr.fhir.delete({ resourceType: 'Location', id: this.prebookVirtualLocation.id });
      } catch (error) {
        console.warn('Failed to delete prebook virtual test location:', error);
      }
    }
  }
}
