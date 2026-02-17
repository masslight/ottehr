import { Location, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ConcreteLocationsOverrides } from '../booking-flow-concrete-smoke-configs';
import { ResourceHandler } from '../resource-handler';

/**
 * Created location with its original config name and worker-suffixed name
 */
export interface CreatedConcreteLocation {
  /** Original name from config (e.g., 'Mordor') */
  originalName: string;
  /** Worker-suffixed name (e.g., 'Mordor-worker123') */
  suffixedName: string;
  /** Created FHIR Location resource */
  location: Location;
  /** Created FHIR Schedule resource */
  schedule: Schedule;
  /** Whether this is a virtual/telemed location */
  isVirtual: boolean;
}

/**
 * Manages test locations and schedules for e2e booking tests
 *
 * Creates 24/7 locations with schedules for both walk-in and prebook tests.
 * Each instance uses a unique worker ID to ensure test isolation when running in parallel.
 */
export class TestLocationManager {
  private resourceHandler: ResourceHandler;
  private workerUniqueId: string;
  private walkinLocation?: Location;
  private walkinSchedule?: Schedule;
  private prebookInPersonLocation?: Location;
  private prebookInPersonSchedule?: Schedule;
  private prebookVirtualLocation?: Location;
  private prebookVirtualSchedule?: Schedule;
  /** Locations created from concrete configs, keyed by config ID */
  private concreteConfigLocations: Map<string, CreatedConcreteLocation[]> = new Map();

  /**
   * @param workerUniqueId - Unique identifier for this worker to isolate test resources
   */
  constructor(workerUniqueId: string) {
    this.resourceHandler = new ResourceHandler();
    this.workerUniqueId = workerUniqueId;
  }

  /**
   * Initialize the resource handler
   */
  async init(): Promise<void> {
    await this.resourceHandler.initApi();
  }

  /**
   * Create a 24/7 schedule for a location
   */
  private async create247Schedule(params: {
    locationId: string;
    locationName: string;
    processId: string;
    tagCode: string;
    capacity?: number;
    timezone?: string;
  }): Promise<Schedule> {
    const oystehr = this.resourceHandler.apiClient;
    const { locationId, locationName, processId, tagCode, capacity = 10, timezone = 'America/New_York' } = params;

    const now = DateTime.now().toUTC();
    const oneYearFromNow = now.plus({ years: 1 });

    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      capacity,
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
          reference: `Location/${locationId}`,
          display: locationName,
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
          valueString: timezone,
        },
      ],
      meta: {
        tag: [
          {
            system: processId,
            code: tagCode,
            display: `E2E Test Schedule: ${locationName}`,
          },
        ],
      },
    };

    const createdSchedule = await oystehr.fhir.create(schedule);

    if (!createdSchedule.id) {
      throw new Error(`Failed to create schedule for location: ${locationName}`);
    }

    return createdSchedule;
  }

  /**
   * Create or update a test location with 24/7 schedule
   * This ensures walk-in tests can always run regardless of time
   */
  async ensureAlwaysOpenLocation(): Promise<{ location: Location; schedule: Schedule }> {
    const oystehr = this.resourceHandler.apiClient;
    const processId = this.workerUniqueId;

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
    this.walkinSchedule = await this.create247Schedule({
      locationId: this.walkinLocation.id,
      locationName: this.walkinLocation.name || 'Walk-in Location',
      processId,
      tagCode: 'test-schedule-24-7',
      capacity: 10,
    });

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
    const processId = this.workerUniqueId;

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
    this.prebookInPersonSchedule = await this.create247Schedule({
      locationId: this.prebookInPersonLocation.id,
      locationName: this.prebookInPersonLocation.name || 'Prebook In-Person Location',
      processId,
      tagCode: 'test-schedule-prebook-in-person',
      capacity: 8,
    });

    return { location: this.prebookInPersonLocation, schedule: this.prebookInPersonSchedule };
  }

  /**
   * Create a test location for virtual prebook flows with plenty of available slots
   * Creates 8 slots per hour, 24/7 to ensure reliable test execution
   * Includes virtual extension to mark location as virtual/telemed
   */
  async ensurePrebookVirtualLocationWithSlots(): Promise<{ location: Location; schedule: Schedule }> {
    const oystehr = this.resourceHandler.apiClient;
    const processId = this.workerUniqueId;

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
    this.prebookVirtualSchedule = await this.create247Schedule({
      locationId: this.prebookVirtualLocation.id,
      locationName: this.prebookVirtualLocation.name || 'Prebook Virtual Location',
      processId,
      tagCode: 'test-schedule-prebook-virtual',
      capacity: 8,
      timezone: 'America/Los_Angeles',
    });

    return { location: this.prebookVirtualLocation, schedule: this.prebookVirtualSchedule };
  }

  /**
   * Create test locations from a concrete config's location overrides.
   * Each location is created with a worker-specific suffix to ensure test isolation.
   * All locations get 24/7 schedules for reliable test execution.
   *
   * @param configId - Unique identifier for the concrete config
   * @param locationsOverrides - The locations configuration from the concrete config
   * @returns Array of created locations with their original and suffixed names
   */
  async ensureConcreteConfigLocations(
    configId: string,
    locationsOverrides: ConcreteLocationsOverrides
  ): Promise<CreatedConcreteLocation[]> {
    const processId = this.workerUniqueId;
    const createdLocations: CreatedConcreteLocation[] = [];

    // Create in-person locations
    for (const locationConfig of locationsOverrides.inPersonLocations) {
      const suffixedName = `${locationConfig.name}-${processId}`;
      const tagCode = `concrete-${configId}-inperson-${locationConfig.name}`.toLowerCase().replace(/\s/g, '-');

      // Check if location already exists
      const existing = await this.findExistingConcreteLocation(processId, tagCode);
      if (existing) {
        createdLocations.push({
          originalName: locationConfig.name,
          suffixedName,
          location: existing.location,
          schedule: existing.schedule,
          isVirtual: false,
        });
        continue;
      }

      // Create new in-person location
      const { location, schedule } = await this.createConcreteLocation({
        name: suffixedName,
        processId,
        tagCode,
        isVirtual: false,
      });

      createdLocations.push({
        originalName: locationConfig.name,
        suffixedName,
        location,
        schedule,
        isVirtual: false,
      });
    }

    // Create telemed/virtual locations
    for (const locationConfig of locationsOverrides.telemedLocations) {
      const suffixedName = `${locationConfig.name}-${processId}`;
      const tagCode = `concrete-${configId}-virtual-${locationConfig.name}`.toLowerCase().replace(/\s/g, '-');

      // Check if location already exists
      const existing = await this.findExistingConcreteLocation(processId, tagCode);
      if (existing) {
        createdLocations.push({
          originalName: locationConfig.name,
          suffixedName,
          location: existing.location,
          schedule: existing.schedule,
          isVirtual: true,
        });
        continue;
      }

      // Create new virtual location
      const { location, schedule } = await this.createConcreteLocation({
        name: suffixedName,
        processId,
        tagCode,
        isVirtual: true,
      });

      createdLocations.push({
        originalName: locationConfig.name,
        suffixedName,
        location,
        schedule,
        isVirtual: true,
      });
    }

    // Store for later cleanup
    this.concreteConfigLocations.set(configId, createdLocations);

    return createdLocations;
  }

  /**
   * Get locations created for a specific concrete config
   */
  getConcreteConfigLocations(configId: string): CreatedConcreteLocation[] {
    return this.concreteConfigLocations.get(configId) || [];
  }

  /**
   * Get a location name mapping for a concrete config (original name -> suffixed name)
   */
  getConcreteConfigLocationNameMap(configId: string): Map<string, string> {
    const locations = this.concreteConfigLocations.get(configId) || [];
    const map = new Map<string, string>();
    for (const loc of locations) {
      map.set(loc.originalName, loc.suffixedName);
    }
    return map;
  }

  /**
   * Find an existing concrete config location by tag
   */
  private async findExistingConcreteLocation(
    processId: string,
    tagCode: string
  ): Promise<{ location: Location; schedule: Schedule } | undefined> {
    const oystehr = this.resourceHandler.apiClient;

    const existingLocations = await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        {
          name: '_tag',
          value: `${processId}|${tagCode}`,
        },
      ],
    });

    const existingLocation = existingLocations.unbundle()[0] as Location | undefined;

    if (existingLocation?.id) {
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
        return { location: existingLocation, schedule: existingSchedule };
      }
    }

    return undefined;
  }

  /**
   * Create a concrete config location with 24/7 schedule
   */
  private async createConcreteLocation(params: {
    name: string;
    processId: string;
    tagCode: string;
    isVirtual: boolean;
  }): Promise<{ location: Location; schedule: Schedule }> {
    const oystehr = this.resourceHandler.apiClient;
    const { name, processId, tagCode, isVirtual } = params;
    const slug = `e2e-${tagCode}-${processId}`.toLowerCase().replace(/\s/g, '-');

    // Create location
    const locationResource: Location = {
      resourceType: 'Location',
      name,
      status: 'active',
      mode: isVirtual ? 'kind' : 'instance',
      address: isVirtual
        ? { state: 'CA', country: 'US' }
        : {
            line: ['123 Test Street'],
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
      extension: isVirtual
        ? [
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
          ]
        : undefined,
      type: isVirtual
        ? undefined
        : [
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
      meta: {
        tag: [
          {
            system: processId,
            code: tagCode,
            display: `E2E Concrete Config Location: ${name}`,
          },
        ],
      },
    };

    const location = await oystehr.fhir.create(locationResource);

    if (!location.id) {
      throw new Error(`Failed to create concrete config location: ${name}`);
    }

    // Create 24/7 schedule using the helper
    const schedule = await this.create247Schedule({
      locationId: location.id,
      locationName: location.name || name,
      processId,
      tagCode: `${tagCode}-schedule`,
      capacity: 10,
      timezone: isVirtual ? 'America/Los_Angeles' : 'America/New_York',
    });

    return { location, schedule };
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

    // Clean up concrete config locations
    for (const [configId, locations] of this.concreteConfigLocations.entries()) {
      for (const loc of locations) {
        if (loc.schedule?.id) {
          try {
            await oystehr.fhir.delete({ resourceType: 'Schedule', id: loc.schedule.id });
          } catch (error) {
            console.warn(`Failed to delete concrete config schedule for ${configId}/${loc.originalName}:`, error);
          }
        }

        if (loc.location?.id) {
          try {
            await oystehr.fhir.delete({ resourceType: 'Location', id: loc.location.id });
          } catch (error) {
            console.warn(`Failed to delete concrete config location for ${configId}/${loc.originalName}:`, error);
          }
        }
      }
    }

    this.concreteConfigLocations.clear();
  }
}
