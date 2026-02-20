import { BatchInputDeleteRequest } from '@oystehr/sdk';
import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  SCHEDULE_STRATEGY_SYSTEM,
  ScheduleStrategy,
  SERVICE_CATEGORY_SYSTEM,
  ServiceMode,
  ServiceModeCoding,
  SLUG_SYSTEM,
} from 'utils';
import { ResourceHandler } from '../resource-handler';

/**
 * Created group booking resources (HealthcareService with Location and Practitioner members)
 */
export interface CreatedGroupBookingResources {
  /** The HealthcareService that groups the booking resources */
  healthcareService: HealthcareService;
  /** The Location member */
  location: Location;
  /** The Practitioner member */
  practitioner: Practitioner;
  /** The PractitionerRole linking Practitioner to HealthcareService */
  practitionerRole: PractitionerRole;
  /** Schedule for the Location */
  locationSchedule: Schedule;
  /** Schedule for the Practitioner */
  practitionerSchedule: Schedule;
  /** The display name for the group (HealthcareService.name) */
  name: string;
  /** The slug identifier for the group (used for bookingOn URL param) */
  slug: string;
  /** Service mode (in-person or virtual) */
  serviceMode: ServiceMode;
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
  /** Group booking resources for prebook in-person */
  private prebookInPersonGroup?: CreatedGroupBookingResources;

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
   * Create a 24/7 schedule for a resource (Location, Practitioner, or HealthcareService)
   */
  private async create247Schedule(params: {
    actorType: 'Location' | 'Practitioner' | 'HealthcareService';
    actorId: string;
    actorName: string;
    processId: string;
    tagCode: string;
    capacity?: number;
    timezone?: string;
  }): Promise<Schedule> {
    const oystehr = this.resourceHandler.apiClient;
    const { actorType, actorId, actorName, processId, tagCode, capacity = 10, timezone = 'America/New_York' } = params;

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
          reference: `${actorType}/${actorId}`,
          display: actorName,
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
            display: `E2E Test Schedule: ${actorName}`,
          },
        ],
      },
    };

    const createdSchedule = await oystehr.fhir.create(schedule);

    if (!createdSchedule.id) {
      throw new Error(`Failed to create schedule for ${actorType}: ${actorName}`);
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
      name: `E2E-WalkIn-${processId}`,
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
      actorType: 'Location',
      actorId: this.walkinLocation.id,
      actorName: this.walkinLocation.name || 'Walk-in Location',
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
    const slug = `e2e-pb-${processId}`.toLowerCase().replace(/\s/g, '-');
    const location: Location = {
      resourceType: 'Location',
      name: `E2E-Prebook-${processId}`,
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
      actorType: 'Location',
      actorId: this.prebookInPersonLocation.id,
      actorName: this.prebookInPersonLocation.name || 'Prebook In-Person Location',
      processId,
      tagCode: 'test-schedule-prebook-in-person',
      capacity: 8,
    });

    return { location: this.prebookInPersonLocation, schedule: this.prebookInPersonSchedule };
  }

  /**
   * Create a Group booking setup for in-person prebook flows.
   *
   * Creates a HealthcareService with one Location member and one Practitioner member,
   * using the 'poolsAll' schedule strategy. Both members have their own 24/7 schedules.
   * This tests the "group booking" pattern used by the core environment.
   *
   * @returns Created group booking resources including HealthcareService, Location, Practitioner, and Schedules
   */
  async ensurePrebookInPersonGroupWithSlots(): Promise<CreatedGroupBookingResources> {
    const oystehr = this.resourceHandler.apiClient;
    const processId = this.workerUniqueId;
    const tagCode = 'test-group-prebook-in-person';

    // Check if we already have a cached group
    if (this.prebookInPersonGroup) {
      return this.prebookInPersonGroup;
    }

    // Search for existing test group by tag
    const existingHCS = await oystehr.fhir.search<HealthcareService>({
      resourceType: 'HealthcareService',
      params: [
        {
          name: '_tag',
          value: `${processId}|${tagCode}`,
        },
      ],
    });

    const existingHealthcareService = existingHCS.unbundle()[0] as HealthcareService | undefined;

    if (existingHealthcareService?.id) {
      // Try to find all related resources
      console.log(`Found existing HealthcareService: ${existingHealthcareService.id}, looking for related resources`);
      const group = await this.findExistingGroupResources(existingHealthcareService, processId, tagCode);
      if (group) {
        this.prebookInPersonGroup = group;
        return group;
      }
      // If we couldn't find all related resources, we'll create new ones
      console.log('Could not find all related resources, creating new group');
    }

    // Create the Location member
    const locationSlug = `e2e-grp-loc-${processId}`.toLowerCase().replace(/\s/g, '-');
    const location: Location = {
      resourceType: 'Location',
      name: `E2E-GroupLoc-${processId}`,
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
        line: ['789 Group Test Street'],
        city: 'Test City',
        state: 'CA',
        postalCode: '90210',
        country: 'US',
      },
      identifier: [
        {
          system: SLUG_SYSTEM,
          value: locationSlug,
        },
      ],
      meta: {
        tag: [
          {
            system: processId,
            code: `${tagCode}-location`,
            display: 'E2E Test Group Location',
          },
        ],
      },
    };

    const createdLocation = await oystehr.fhir.create(location);
    if (!createdLocation.id) {
      throw new Error('Failed to create group location');
    }
    console.log(`Created group location: ${createdLocation.id}`);

    // Create the Practitioner member
    const practitioner: Practitioner = {
      resourceType: 'Practitioner',
      active: true,
      name: [
        {
          family: `TestProvider-${processId}`,
          given: ['E2E'],
          prefix: ['Dr.'],
        },
      ],
      meta: {
        tag: [
          {
            system: processId,
            code: `${tagCode}-practitioner`,
            display: 'E2E Test Group Practitioner',
          },
        ],
      },
    };

    const createdPractitioner = await oystehr.fhir.create(practitioner);
    if (!createdPractitioner.id) {
      throw new Error('Failed to create group practitioner');
    }
    console.log(`Created group practitioner: ${createdPractitioner.id}`);

    // Create the HealthcareService
    const hcsSlug = `e2e-grp-${processId}`.toLowerCase().replace(/\s/g, '-');
    const healthcareService: HealthcareService = {
      resourceType: 'HealthcareService',
      active: true,
      name: `E2E-Group-${processId}`,
      location: [
        {
          reference: `Location/${createdLocation.id}`,
        },
      ],
      characteristic: [
        // Service mode: in-person
        {
          coding: [
            {
              system: ServiceModeCoding.inPerson.system,
              code: ServiceModeCoding.inPerson.code,
              display: ServiceModeCoding.inPerson.display,
            },
          ],
        },
        // Schedule strategy: pools all (Location + Practitioner)
        {
          coding: [
            {
              system: SCHEDULE_STRATEGY_SYSTEM,
              code: ScheduleStrategy.poolsAll,
              display: 'Pools All',
            },
          ],
        },
        // Service category: urgent-care
        {
          coding: [
            {
              system: SERVICE_CATEGORY_SYSTEM,
              code: 'urgent-care',
              display: 'Urgent Care',
            },
          ],
        },
      ],
      identifier: [
        {
          system: SLUG_SYSTEM,
          value: hcsSlug,
        },
      ],
      meta: {
        tag: [
          {
            system: processId,
            code: tagCode,
            display: 'E2E Test Group HealthcareService',
          },
        ],
      },
    };

    const createdHCS = await oystehr.fhir.create(healthcareService);
    if (!createdHCS.id) {
      throw new Error('Failed to create group HealthcareService');
    }
    console.log(`Created group HealthcareService: ${createdHCS.id}`);

    // Create PractitionerRole to link Practitioner to HealthcareService
    const practitionerRole: PractitionerRole = {
      resourceType: 'PractitionerRole',
      active: true,
      practitioner: {
        reference: `Practitioner/${createdPractitioner.id}`,
      },
      healthcareService: [
        {
          reference: `HealthcareService/${createdHCS.id}`,
        },
      ],
      location: [
        {
          reference: `Location/${createdLocation.id}`,
        },
      ],
      meta: {
        tag: [
          {
            system: processId,
            code: `${tagCode}-practitioner-role`,
            display: 'E2E Test Group PractitionerRole',
          },
        ],
      },
    };

    const createdPractitionerRole = await oystehr.fhir.create(practitionerRole);
    if (!createdPractitionerRole.id) {
      throw new Error('Failed to create group PractitionerRole');
    }
    console.log(`Created group PractitionerRole: ${createdPractitionerRole.id}`);

    // Create Schedule for the Location
    const locationSchedule = await this.create247Schedule({
      actorType: 'Location',
      actorId: createdLocation.id,
      actorName: createdLocation.name || 'Group Location',
      processId,
      tagCode: `${tagCode}-location-schedule`,
      capacity: 8,
    });
    console.log(`Created group location schedule: ${locationSchedule.id}`);

    // Create Schedule for the Practitioner
    const practitionerSchedule = await this.create247Schedule({
      actorType: 'Practitioner',
      actorId: createdPractitioner.id,
      actorName: 'Dr. E2E TestProvider',
      processId,
      tagCode: `${tagCode}-practitioner-schedule`,
      capacity: 8,
    });
    console.log(`Created group practitioner schedule: ${practitionerSchedule.id}`);

    this.prebookInPersonGroup = {
      healthcareService: createdHCS,
      location: createdLocation,
      practitioner: createdPractitioner,
      practitionerRole: createdPractitionerRole,
      locationSchedule,
      practitionerSchedule,
      name: createdHCS.name!,
      slug: hcsSlug,
      serviceMode: ServiceMode['in-person'],
    };

    return this.prebookInPersonGroup;
  }

  /**
   * Get the created group booking resources for prebook in-person flows
   */
  getPrebookInPersonGroup(): CreatedGroupBookingResources | undefined {
    return this.prebookInPersonGroup;
  }

  /**
   * Find existing group resources by searching for related resources
   */
  private async findExistingGroupResources(
    healthcareService: HealthcareService,
    processId: string,
    tagCode: string
  ): Promise<CreatedGroupBookingResources | undefined> {
    const oystehr = this.resourceHandler.apiClient;

    // Find location
    const locations = await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [{ name: '_tag', value: `${processId}|${tagCode}-location` }],
    });
    const location = locations.unbundle()[0] as Location | undefined;

    // Find practitioner
    const practitioners = await oystehr.fhir.search<Practitioner>({
      resourceType: 'Practitioner',
      params: [{ name: '_tag', value: `${processId}|${tagCode}-practitioner` }],
    });
    const practitioner = practitioners.unbundle()[0] as Practitioner | undefined;

    // Find practitioner role
    const roles = await oystehr.fhir.search<PractitionerRole>({
      resourceType: 'PractitionerRole',
      params: [{ name: '_tag', value: `${processId}|${tagCode}-practitioner-role` }],
    });
    const practitionerRole = roles.unbundle()[0] as PractitionerRole | undefined;

    if (!location?.id || !practitioner?.id || !practitionerRole?.id) {
      return undefined;
    }

    // Find schedules
    const locationSchedules = await oystehr.fhir.search<Schedule>({
      resourceType: 'Schedule',
      params: [{ name: 'actor', value: `Location/${location.id}` }],
    });
    const locationSchedule = locationSchedules.unbundle()[0] as Schedule | undefined;

    const practitionerSchedules = await oystehr.fhir.search<Schedule>({
      resourceType: 'Schedule',
      params: [{ name: 'actor', value: `Practitioner/${practitioner.id}` }],
    });
    const practitionerSchedule = practitionerSchedules.unbundle()[0] as Schedule | undefined;

    if (!locationSchedule?.id || !practitionerSchedule?.id) {
      return undefined;
    }

    // Extract slug from HealthcareService identifier
    const slug = healthcareService.identifier?.find((id) => id.system === SLUG_SYSTEM)?.value;
    if (!slug) {
      console.warn('HealthcareService missing slug identifier');
      return undefined;
    }

    return {
      healthcareService,
      location,
      practitioner,
      practitionerRole,
      locationSchedule,
      practitionerSchedule,
      name: healthcareService.name!,
      slug,
      serviceMode: ServiceMode['in-person'],
    };
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
    const slug = `e2e-virt-${processId}`.toLowerCase().replace(/\s/g, '-');
    const location: Location = {
      resourceType: 'Location',
      name: `E2E-Virtual-${processId}`,
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
      actorType: 'Location',
      actorId: this.prebookVirtualLocation.id,
      actorName: this.prebookVirtualLocation.name || 'Prebook Virtual Location',
      processId,
      tagCode: 'test-schedule-prebook-virtual',
      capacity: 8,
      timezone: 'America/Los_Angeles',
    });

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

    // Clean up prebook in-person group (HealthcareService, Practitioner, PractitionerRole, and their schedules)
    if (this.prebookInPersonGroup) {
      const group = this.prebookInPersonGroup;
      const deleteRequests: BatchInputDeleteRequest[] = [];

      // Collect all resources to delete
      if (group.locationSchedule?.id) {
        deleteRequests.push({ method: 'DELETE', url: `/Schedule/${group.locationSchedule.id}` });
      }
      if (group.practitionerSchedule?.id) {
        deleteRequests.push({ method: 'DELETE', url: `/Schedule/${group.practitionerSchedule.id}` });
      }
      if (group.practitionerRole?.id) {
        deleteRequests.push({ method: 'DELETE', url: `/PractitionerRole/${group.practitionerRole.id}` });
      }
      if (group.healthcareService?.id) {
        deleteRequests.push({ method: 'DELETE', url: `/HealthcareService/${group.healthcareService.id}` });
      }
      if (group.practitioner?.id) {
        deleteRequests.push({ method: 'DELETE', url: `/Practitioner/${group.practitioner.id}` });
      }
      if (group.location?.id) {
        deleteRequests.push({ method: 'DELETE', url: `/Location/${group.location.id}` });
      }

      if (deleteRequests.length > 0) {
        try {
          await oystehr.fhir.batch({ requests: deleteRequests });
          console.log(`Deleted ${deleteRequests.length} group booking resources`);
        } catch (error) {
          console.warn('Failed to batch delete group booking resources:', error);
        }
      }

      this.prebookInPersonGroup = undefined;
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
