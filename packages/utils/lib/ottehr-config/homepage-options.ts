/**
 * Homepage options enum - standalone file to avoid circular dependencies.
 * This file has no imports from ottehr-config or types barrels.
 */
export enum HomepageOptions {
  StartInPersonVisit = 'start-in-person-visit',
  ScheduleInPersonVisit = 'schedule-in-person-visit',
  StartVirtualVisit = 'start-virtual-visit',
  ScheduleVirtualVisit = 'schedule-virtual-visit',
}
