import {
  IsoDate,
  ProviderScheduleConfig,
  ScheduledAppointment,
  ScheduleLocation,
  ScheduleProvider,
  ScheduleVisitType,
} from 'utils/lib/provider-schedule/types';

/**
 * The data the provider-schedule screens need. Each method maps onto one future zambda
 * endpoint; `mockProviderScheduleApi` implements it with seeded in-browser data until those
 * exist. Swap the implementation in `useProviderScheduleApi` — nothing else should change.
 *
 * Intended backing (for whoever builds the zambdas):
 * - listProviders      → PractitionerRoles with a primary-care schedule, joined to Practitioner
 * - listLocations      → Locations (timezone from the existing timezone extension)
 * - listVisitTypes     → service categories (HealthcareService) incl. their durationMinutes
 * - getScheduleConfig  → the provider's Schedule resource, config stored in a new extension
 *                        alongside (not replacing) the existing hourly ScheduleExtension
 * - saveScheduleConfig → same, plus regenerating bookable Slots for the affected window
 * - listAppointments   → Appointments for the provider's PractitionerRole in [start, end]
 */
export interface ProviderScheduleApi {
  listProviders(): Promise<ScheduleProvider[]>;
  listLocations(): Promise<ScheduleLocation[]>;
  listVisitTypes(): Promise<ScheduleVisitType[]>;
  getScheduleConfig(providerId: string): Promise<ProviderScheduleConfig>;
  saveScheduleConfig(config: ProviderScheduleConfig): Promise<ProviderScheduleConfig>;
  listAppointments(input: {
    providerId: string;
    startDate: IsoDate;
    endDate: IsoDate;
  }): Promise<ScheduledAppointment[]>;
}
